import 'express';
import { employeeTable } from '../../lib/database/schema/employee.js';

type Employee = typeof employeeTable.$inferSelect

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        name: string;
        role: Employee['role'];
      };
    }
  }
}