import bcrypt from 'bcryptjs';
import { db } from '../lib/db';

export const authService = {
    async login(username: string, password: string) {
        try {
            const user = await db.users.findUnique({
                where: { username },
            });

            if (!user) {
                throw new Error('Invalid username or password');
            }

            if (!user.isActive) {
                throw new Error('User account is disabled');
            }

            // Check Plain Text first, then Hash
            let isValidPassword = password === user.password;
            if (!isValidPassword) {
                isValidPassword = await bcrypt.compare(password, user.password);
            }

            if (!isValidPassword) {
                throw new Error('Invalid username or password');
            }

            // Return user without password
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch (error) {
            throw error;
        }
    },

    async createUser(data: {
        username: string;
        password: string;
        name: string;
        role: string;
    }) {
        // Plain text password storage (Requested by User)
        return db.users.create({
            data: data
        });
    },

    async changePassword(userId: string, oldPassword: string, newPassword: string) {
        const user = await db.users.findUnique({ where: { id: userId } });

        if (!user) {
            throw new Error('User not found');
        }

        // Check Plain Text first, then Hash
        let isValidPassword = oldPassword === user.password;
        if (!isValidPassword) {
            isValidPassword = await bcrypt.compare(oldPassword, user.password);
        }

        if (!isValidPassword) {
            throw new Error('Invalid current password');
        }

        return db.users.update({
            where: { id: userId },
            data: { password: newPassword },
        });
    },
};
