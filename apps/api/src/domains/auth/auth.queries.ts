import type { AdminUser } from '@prisma/client'
import { prisma } from '../../config/db.js'

export async function findAdminUserByEmail(
  email: string,
): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({ where: { email } })
}

export async function findAdminUserById(
  id: string,
): Promise<AdminUser | null> {
  return prisma.adminUser.findUnique({ where: { id } })
}
