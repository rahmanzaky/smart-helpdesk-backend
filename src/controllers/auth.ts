import 'dotenv/config';
import { db } from '../lib/database/db.js';
import { type NextFunction, type Request, type Response } from 'express';
import { emailVerificationToken, employeeTable, passwordResetToken, refreshTokens } from '../lib/database/schema/employee.js';
import { sendResetMail, sendVerificationMail } from '../lib/helper/email.js';
import { and, eq, ne, desc } from 'drizzle-orm';
import argon2 from 'argon2';
import * as crypto from 'crypto';
import { addLogs } from '../lib/helper/logs.js';

interface RegisterApiBody {
  email: string;
  name: string;
  password: string;
}

export async function register(req: Request, res: Response) {
  const body = req.body as RegisterApiBody;
  if (!body || !body.email || !body.name || !body.password) {
    return res.status(400).send({ error: 'email, name, and password are required' });
  }

  try {
    const email = body.email.toLowerCase().trim();
    const [existing] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.email, email));

    if (existing && !existing.isVerified) {
      const [existingToken] = await db
        .select()
        .from(emailVerificationToken)
        .where(
          and(
            eq(emailVerificationToken.userId, existing.id),
            eq(emailVerificationToken.revoked, false)
          )
        )
        .orderBy(desc(emailVerificationToken.createdAt))
        .limit(1);

      //60s timeout
      if (
        existingToken &&
        existingToken.createdAt > new Date(Date.now() - 60_000)
      ) {
        return res.status(429).send({
          error: 'Please wait before requesting another reset email'
        });
      }
      const { rawToken, hashedToken } = getToken();
      const newToken = await db
        .insert(emailVerificationToken)
        .values({
          userId: existing.id,
          tokenHash: hashedToken,
          expiresAt: new Date(new Date().getTime() + (1000 * 60 * 60 * 24)),
        })
        .returning();
      const { data, error } = await sendVerificationMail(body.email, rawToken);
      if (error) {
        return res.status(500).send({ message: 'failed to send verification email', error });
      }
      return res.status(400).send({ error: 'email already exists' });
    } else if (existing && existing.isVerified) {
      return res.status(400).send({ error: 'email already exists' });
    }

    const hash = await argon2.hash(body.password);
    const [result] = await db
      .insert(employeeTable)
      .values({
        email,
        name: body.name,
        password: hash,
      })
      .returning();

    if (!result) {
      return res.status(500).send({ error: `server error` });
    }

    const { rawToken, hashedToken } = getToken();
    await db.insert(emailVerificationToken).values({
      userId: result.id,
      tokenHash: hashedToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 15)
    });

    const { data, error } = await sendVerificationMail(body.email, rawToken);
    if (error) {
      return res.status(201).send({ message: 'user created, failed to send verification email', error });
    }

    const userInfo = {
      id: result.id,
      name: result.name,
      email: result.email,
      role: result.role,
      isVerified: result.isVerified,
      deleted: result.deleted,
    }

    await addLogs('REGISTER', result.id, result.name);

    return res.status(201).send({ message: 'user created, verification email sent', data: userInfo });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: `${error}` });
  }
}

export async function verify(req: Request, res: Response) {
  const body = req.body;
  const TOKEN_EXPIRATION_TIME = 1000 * 60 * 60 * 8; //8hrs
  const TOKEN_EXPIRATION_DATE = new Date(new Date().getTime() + TOKEN_EXPIRATION_TIME);

  if (!body || !body.id || !body.token) {
    return res.status(400).send({ error: 'incomplete request body.' });
  }

  try {
    const [existing] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.id, body.id));

    if (!existing) {
      return res.status(404).send();
    }

    if (existing.isVerified) {
      return res.status(400).send({ error: 'Already verified' })
    }

    const [existingToken] = await db
      .select()
      .from(emailVerificationToken)
      .where(eq(emailVerificationToken.userId, existing.id))
      .orderBy(desc(emailVerificationToken.createdAt))
      .limit(1);

    if (!existingToken || new Date(existingToken.expiresAt).getTime() < new Date().getTime() || existingToken.revoked) {
      if (existingToken && existingToken.createdAt > new Date(Date.now() - 60_000)) {
        return res.status(429).send({ error: 'Please wait before requesting another token' });
      }
      const { rawToken, hashedToken } = getToken();
      await db
        .insert(emailVerificationToken)
        .values({
          userId: existing.id,
          tokenHash: hashedToken,
          expiresAt: new Date(new Date().getTime() + (1000 * 60 * 60 * 24)),
        })
      const { data, error } = await sendVerificationMail(existing.email, rawToken);
      return res.status(410).send({ message: 'Verification Token expired, new email sent' });
    }

    const isValid = crypto
      .createHash('sha256')
      .update(body.token)
      .digest('hex') === existingToken.tokenHash;

    if (!isValid) {
      return res.status(401).send({ error: 'Unauthorized' })
    }

    const [result] = await db
      .update(employeeTable)
      .set({ isVerified: true })
      .where(eq(employeeTable.id, body.id))
      .returning();

    if (!result) {
      return res.status(500).send({ error: `server error` });
    }

    await db
      .update(emailVerificationToken)
      .set({
        revoked: true
      })
      .where(eq(emailVerificationToken.userId, existing.id))

    const { rawToken, hashedToken } = getToken();

    await db
      .insert(refreshTokens)
      .values({
        userId: result.id,
        tokenHash: hashedToken,
        expiresAt: TOKEN_EXPIRATION_DATE
      })

    const userInfo = {
      id: result.id,
      name: result.name,
      email: result.email,
      role: result.role,
      isVerified: result.isVerified,
      deleted: result.deleted,
    }

    res.cookie('token', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: TOKEN_EXPIRATION_TIME,
      path: '/'
    });
    return res.status(200).send({ data: userInfo })

  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: `${error}` });
  }
}

interface LoginApiBody {
  email: string;
  password: string;
}

export async function login(req: Request, res: Response) {
  const body = req.body as LoginApiBody;
  const TOKEN_EXPIRATION_TIME = 1000 * 60 * 60 * 8; //8hrs
  const TOKEN_EXPIRATION_DATE = new Date(new Date().getTime() + TOKEN_EXPIRATION_TIME);

  if (!body || !body.email || !body.password) {
    return res.status(400).send({ error: 'email and password required.' });
  }

  try {
    const [user] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.email, body.email.toLowerCase().trim()));

    if (!user) {
      return res.status(400).send({ error: 'incorrect email or password.' });
    }

    if (!user.isVerified) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const isCorrect = await argon2.verify(user.password, body.password);
    if (!isCorrect) {
      return res.status(400).send({ error: 'incorrect email or password.' });
    }

    const { rawToken, hashedToken } = getToken();

    const [newToken] = await db
      .insert(refreshTokens)
      .values({
        userId: user.id,
        tokenHash: hashedToken,
        expiresAt: TOKEN_EXPIRATION_DATE
      })
      .returning();

    if (!newToken) {
      return res.status(500).send({ error: `server error` });
    }

    await db
      .update(refreshTokens)
      .set({
        replacedBy: newToken.id,
        revoked: true,
      })
      .where(
        and(
          eq(refreshTokens.userId, user.id),
          eq(refreshTokens.revoked, false),
          ne(refreshTokens.id, newToken.id)
        ));

    const userInfo = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      deleted: user.deleted,
    }

    res.cookie('token', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: TOKEN_EXPIRATION_TIME,
      path: '/',
    });

    addLogs('LOGIN', user.id, user.name);

    return res.status(200).send({ data: userInfo })
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: `${error}` });
  }
}

export async function logout(req: Request, res: Response) {
  const rawToken = req.cookies?.token;

  if (!rawToken) {
    return res.sendStatus(204); // already logged out
  }

  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const [t] = await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.tokenHash, hashedToken))
      .returning();

    const [user] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.id, t!.userId));

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    });

    addLogs('LOGOUT', user!.id, user!.name);

    return res.sendStatus(204);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

interface RefreshApiBody {
  userId: number;
}

export async function refresh(req: Request, res: Response) {
  const rawToken = req.cookies?.token;
  const TOKEN_EXPIRATION_TIME = 1000 * 60 * 60 * 8; //8hrs
  const TOKEN_EXPIRATION_DATE = new Date(new Date().getTime() + TOKEN_EXPIRATION_TIME);

  if (!rawToken) {
    return res.sendStatus(401);
  }

  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashedToken));

    if (!storedToken) {
      return res.sendStatus(403);
    }

    // expired
    if (new Date(storedToken.expiresAt) < new Date()) {
      return res.sendStatus(403);
    }

    // reuse detection
    if (storedToken.revoked) {
      // revoke ALL user tokens (possible token theft)
      await db
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.userId, storedToken.userId));

      return res.sendStatus(403);
    }

    const { rawToken: newRawToken, hashedToken: newHashedToken } = getToken();

    const [newToken] = await db
      .insert(refreshTokens)
      .values({
        userId: storedToken.userId,
        tokenHash: newHashedToken,
        expiresAt: TOKEN_EXPIRATION_DATE
      })
      .returning();

    if (!newToken) {
      return res.status(500).send({ error: `server error` });
    }

    await db
      .update(refreshTokens)
      .set({
        revoked: true,
        replacedBy: newToken.id
      })
      .where(eq(refreshTokens.id, storedToken.id));

    res.cookie('token', newRawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: TOKEN_EXPIRATION_TIME,
      path: '/'
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

export async function forgotPassword(req: Request, res: Response) {
  const body = req.body as { email: string };

  if (!body?.email) {
    return res.status(400).send({ error: 'email is required' });
  }

  try {
    const email = body.email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.email, email));

    if (!user) {
      return res.status(200).send({
        message: 'Reset link has been sent'
      });
    }

    const [existingToken] = await db
      .select()
      .from(passwordResetToken)
      .where(
        and(
          eq(passwordResetToken.userId, user.id),
          eq(passwordResetToken.revoked, false)
        )
      )
      .orderBy(desc(passwordResetToken.createdAt))
      .limit(1);

    //60s timeout
    if (
      existingToken &&
      existingToken.createdAt > new Date(Date.now() - 60_000)
    ) {
      return res.status(429).send({
        error: 'Please wait before requesting another reset email'
      });
    }

    const { rawToken, hashedToken } = getToken();

    await db.insert(passwordResetToken).values({
      userId: user.id,
      tokenHash: hashedToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 min
    });

    await sendResetMail(user.email, rawToken);

    return res.status(200).send({
      message: 'Reset link has been sent'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send({ error: 'server error' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const body = req.body as {
    userId: number;
    token: string;
    newPassword: string;
  };

  if (!body?.userId || !body?.token || !body?.newPassword) {
    return res.status(400).send({ error: 'invalid request' });
  }

  try {
    const [user] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.id, body.userId));

    if (!user) {
      return res.status(400).send({ error: 'invalid request' });
    }

    const [existingToken] = await db
      .select()
      .from(passwordResetToken)
      .where(
        and(
          eq(passwordResetToken.userId, user.id),
          eq(passwordResetToken.revoked, false)
        )
      )
      .orderBy(desc(passwordResetToken.createdAt))
      .limit(1);

    if (!existingToken) {
      return res.status(400).send({ error: 'invalid or expired token' });
    }

    // expired
    if (existingToken.expiresAt < new Date()) {
      return res.status(410).send({ error: 'token expired' });
    }

    // validate token
    const hash = crypto
      .createHash('sha256')
      .update(body.token)
      .digest('hex');

    if (hash !== existingToken.tokenHash) {
      return res.status(401).send({ error: 'unauthorized' });
    }

    // hash new password
    const newHash = await argon2.hash(body.newPassword);

    // update password
    await db
      .update(employeeTable)
      .set({ password: newHash })
      .where(eq(employeeTable.id, user.id));

    // revoke all reset tokens
    await db
      .update(passwordResetToken)
      .set({ revoked: true })
      .where(eq(passwordResetToken.userId, user.id));

    // force logout everywhere
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, user.id));

    addLogs('PASSWORD', user.id, user.name);

    return res.status(200).send({ message: 'password reset successful' });
  } catch (err) {
    console.error(err);
    return res.status(500).send({ error: 'server error' });
  }
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    return res.sendStatus(401);
  }

  try {
    const [user] = await db
      .select({
        id: employeeTable.id,
        name: employeeTable.name,
        email: employeeTable.email,
        role: employeeTable.role,
        createdTime: employeeTable.createdTime,
        isVerified: employeeTable.isVerified
      })
      .from(employeeTable)
      .where(eq(employeeTable.id, req.user.id));

    return res.status(200).send({data: user})
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: 'server error' });
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const rawToken = req.cookies?.token;

  if (!rawToken) {
    return res.sendStatus(401);
  }

  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashedToken));

    if (!storedToken) {
      return res.sendStatus(403);
    }

    if (storedToken.revoked || storedToken.expiresAt < new Date()) {
      return res.sendStatus(403);
    }

    const [user] = await db
      .select()
      .from(employeeTable)
      .where(eq(employeeTable.id, storedToken.userId));

    // attach user info to request
    req.user = {
      id: storedToken.userId,
      name: user!.name,
      role: user!.role,
    };

    next();
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
}

function getToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  return { rawToken, hashedToken };
}