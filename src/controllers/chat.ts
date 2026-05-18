import { db } from '../lib/database/db.js';
import { type NextFunction, type Request, type Response } from 'express';
import { and, eq, ne, desc } from 'drizzle-orm';
import { chatTable, messageAttachment, messageAttachmentJoint, messagesTable } from '../lib/database/schema/chat.js';
import { employeeTable } from '../lib/database/schema/employee.js';
import { uploadToR2Buffer } from '../lib/helper/image.js';
import Busboy from 'busboy';
import { addLogs } from '../lib/helper/logs.js';

export async function getChats(req: Request, res: Response) {
  if (!req.user) {
    return res.sendStatus(401);
  }

  try {
    const chats = await db
      .select()
      .from(chatTable)
      .where(eq(chatTable.authorId, req.user.id))
      .orderBy(desc(chatTable.createdTime));

    return res.status(200).send({ data: chats });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

export async function insertChat(req: Request, res: Response) {
  const body = req.body as { title: string };

  if (!req.user) {
    return res.sendStatus(401);
  }

  if (!body?.title) {
    return res.status(400).send({ error: 'title is required' });
  }

  try {
    const [user] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.id, req.user.id));

    if (!user || user.deleted) {
      return res.status(403).send({ error: 'Forbidden' });
    }

    const [chat] = await db
      .insert(chatTable)
      .values({
        title: body.title,
        authorId: req.user.id,
        authorName: user.name,
      })
      .returning();

    await addLogs('CHAT', req.user.id, req.user.name);

    return res.status(201).send({ data: chat });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

export async function deleteChat(req: Request, res: Response) {
  const body = req.body as { chatId: number };

  if (!req.user) {
    return res.sendStatus(401);
  }

  try {
    const [user] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.id, req.user.id));

    const [chat] = await db
      .select()
      .from(chatTable)
      .where(eq(chatTable.id, body.chatId));

    if (!user || !chat) {
      return res.status(400);
    }

    const isOwner = chat?.authorId === user?.id;
    if (!isOwner) {
      return res.status(403);
    }

    await db
      .update(chatTable)
      .set({ deleted: true })
      .where(eq(chatTable.id, body.chatId));
    
    await db 
      .update(messagesTable)
      .set({deleted:true})
      .where(eq(messagesTable.chatId, body.chatId));
    
    return res.status(200);
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
}

export async function getChatMessages(req: Request, res: Response) {
  if (!req.user) {
    return res.sendStatus(401);
  }

  const cid = Number(req.query.cid);

  if (isNaN(cid)) {
    return res.status(400).send({ error: 'invalid cid' });
  }

  try {
    const messages = await db.query.messagesTable.findMany({
      where: (t, { eq }) => eq(t.chatId, cid),
      orderBy: (t, { desc }) => desc(t.createdTime),
      with: {
        attachments: {
          with: {
            attachment: true,
          }
        },
      }
    })
    const clean = messages.map((m) => ({
      ...m,
      attachments: m.attachments.map((j) => j.attachment),
    }));
    return res.status(200).send({ data: clean });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

interface InsertMessageBody {
  chatId: number;
  message: string;
  reply?: string;
  attachments?: {
    fileName: string;
    filePath: string;
    url?: string;
    description?: string;
  }[];
}


export async function insertChatMessage(req: Request, res: Response) {
  if (!req.user) {
    return res.sendStatus(401);
  }

  try {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: 10 * 1024 * 1024,
        fieldSize: 100 * 1024,
      }
    });
    const fields: any = {};
    const uploads: Promise<any>[] = [];

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      const chunks: Buffer[] = [];

      file.on("data", (chunk) => {
        chunks.push(chunk);
      });

      file.on("end", () => {
        const buffer = Buffer.concat(chunks);

        const safeName = info.filename
          .replace(/[^a-zA-Z0-9.\-_]/g, "_")
          .slice(0, 100);

        const key = `uploads/${Date.now()}-${safeName}`;

        const uploadPromise = uploadToR2Buffer(buffer, key, info.mimeType);

        uploads.push(uploadPromise);
      });
    })

    busboy.on("finish", async () => {
      try {
        if (!req.user) {
          return res.status(401);
        }
        if (!fields.chatId || !fields.message) {
          return res.status(400).send({ error: 'chatId and message required' });
        }
        const returnPayload: any = {};
        // 1. ensure chat exists & belongs to user
        const [chat] = await db
          .select()
          .from(chatTable)
          .where(
            and(
              eq(chatTable.id, fields.chatId),
              eq(chatTable.authorId, req.user.id)
            )
          );

        if (!chat) {
          return res.status(403).send({ error: 'chat not found' });
        }

        // 2. insert message
        const [msg] = await db
          .insert(messagesTable)
          .values({
            chatId: fields.chatId,
            authorId: req.user.id,
            authorName: req.user.name, // optionally join employeeTable
            message: fields.message,
            reply: fields.reply ?? '',
          })
          .returning();

        if (!msg) {
          return res.status(500).send({ error: 'failed to create message' });
        }
        await addLogs('MESSAGE', req.user.id, req.user.name);
        returnPayload.data = { ...msg, attachments: [] };
        const attachments = await Promise.all(uploads);
        //TODO: insert images to R2
        //TODO: get model reply
        // 3. handle attachments (if any)
        for (const att of attachments) {
          if (!req.user) return res.status(401);
          const [attachment] = await db
            .insert(messageAttachment)
            .values({
              authorId: req.user.id,
              authorName: req.user.name,
              fileName: att.key.split('-')[1],
              filePath: att.key,
              url: att.url,
            })
            .returning();

          if (!attachment) return res.status(500);

          await db.insert(messageAttachmentJoint).values({
            messageId: msg.id,
            attachmentId: attachment.id,
          });

          await addLogs('ATTACHMENT', req.user.id, req.user.name);
          returnPayload.data.attachments.push(attachment);
        }

        // Call AI service and store reply
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const imageUrl = returnPayload.data.attachments[0]?.url ?? null;
        try {
          const aiRes = await fetch(`${aiServiceUrl}/api/v1/chatbot/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: Number(fields.chatId),
              message: fields.message,
              image_url: imageUrl,
            }),
            signal: AbortSignal.timeout(60000),
          });
          const aiData: any = await aiRes.json();
          if (aiData?.success && aiData?.data?.response) {
            await db.update(messagesTable)
              .set({ reply: aiData.data.response })
              .where(eq(messagesTable.id, msg.id));
            returnPayload.data.reply = aiData.data.response;
          }
        } catch (aiErr) {
          console.error('AI service error:', aiErr);
          // non-fatal: message is saved, reply stays empty
        }

        return res.status(201).send({ data: returnPayload.data });
      } catch (err) {
        console.error(err);
        return res.sendStatus(500);
      }
    });
    req.pipe(busboy);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}