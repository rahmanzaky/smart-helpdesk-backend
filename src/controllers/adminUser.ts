import { db } from '../lib/database/db.js';
import { type Request, type Response } from 'express';
import { employeeTable, refreshTokens } from '../lib/database/schema/employee.js';
import { sendWelcomeEmail } from '../lib/helper/email.js';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import * as crypto from 'crypto';

function generateTempPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$';
  const all = upper + lower + digits + special;
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
  // Guarantee at least one of each required type, then fill remaining 8 chars
  const required = [rand(upper), rand(lower), rand(digits), rand(special)];
  const rest = Array.from({ length: 8 }, () => rand(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join('');
}

export async function getUsers(req: Request, res: Response) {
  try {
    const users = await db
      .select({
        id: employeeTable.id,
        name: employeeTable.name,
        email: employeeTable.email,
        role: employeeTable.role,
        isVerified: employeeTable.isVerified,
        createdTime: employeeTable.createdTime,
        mustChangePassword: employeeTable.mustChangePassword,
      })
      .from(employeeTable)
      .where(eq(employeeTable.deleted, false));

    return res.status(200).send({ data: users });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: 'server error' });
  }
}

interface CreateUserBody {
  email: string;
  name: string;
  role: 'employee' | 'admin';
}

export async function createUser(req: Request, res: Response) {
  const body = req.body as CreateUserBody;

  if (!body?.email || !body?.name || !body?.role) {
    return res.status(400).send({ error: 'email, name, and role are required' });
  }

  if (!['employee', 'admin'].includes(body.role)) {
    return res.status(400).send({ error: 'role must be employee or admin' });
  }

  try {
    const email = body.email.toLowerCase().trim();

    const [existing] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.email, email));

    if (existing) {
      return res.status(400).send({ error: 'email already exists' });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await argon2.hash(tempPassword);

    const [newUser] = await db
      .insert(employeeTable)
      .values({
        email,
        name: body.name,
        role: body.role,
        password: hashedPassword,
        isVerified: true,
        mustChangePassword: true,
      })
      .returning({
        id: employeeTable.id,
        name: employeeTable.name,
        email: employeeTable.email,
        role: employeeTable.role,
        isVerified: employeeTable.isVerified,
        createdTime: employeeTable.createdTime,
        mustChangePassword: employeeTable.mustChangePassword,
      });

    if (!newUser) {
      return res.status(500).send({ error: 'server error' });
    }

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, body.name, tempPassword).catch((err) =>
      console.error('Failed to send welcome email:', err)
    );

    return res.status(201).send({ data: newUser });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: 'server error' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (!id || isNaN(id)) {
    return res.status(400).send({ error: 'invalid user id' });
  }

  // Prevent self-deletion
  if (req.user && req.user.id === id) {
    return res.status(400).send({ error: 'cannot delete your own account' });
  }

  try {
    const [user] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.id, id));

    if (!user || user.deleted) {
      return res.status(404).send({ error: 'user not found' });
    }

    // Soft delete
    await db
      .update(employeeTable)
      .set({ deleted: true })
      .where(eq(employeeTable.id, id));

    // Revoke all refresh tokens
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, id));

    return res.status(200).send({ message: 'user deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: 'server error' });
  }
}
