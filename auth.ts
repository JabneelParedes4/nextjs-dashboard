import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import { authConfig } from './auth.config';

// Conexión a la base de datos
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// Función para obtener un usuario por correo electrónico
async function getUser(email: string): Promise<User | undefined> {
  try {
    const users = await sql<User[]>`SELECT * FROM users WHERE email=${email}`;
    console.log('Fetched users:', users); // Log para verificar los usuarios
    if (users.length === 0) {
      console.log('No user found with that email');
      return undefined; // Devuelve undefined si no se encuentra el usuario
    }
    return users[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

// Función para registrar un nuevo usuario
async function registerUser(email: string, password: string): Promise<void> {
  const hashedPassword = await bcrypt.hash(password, 10); // Hashea la contraseña
  try {
    await sql`INSERT INTO users (email, password) VALUES (${email}, ${hashedPassword})`;
  } catch (error) {
    console.error('Failed to register user:', error);
    throw new Error('Failed to register user.');
  }
}

// Configuración de NextAuth
export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;

          const user = await getUser(email);
          if (!user) {
            console.log('User not found');
            return null;
          }

          // Logs para depuración
          console.log('User password from DB:', user.password); // Log del hash almacenado
          console.log('Password entered by user:', password); // Log de la contraseña ingresada

          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) {
            return user;
          } else {
            console.log('Invalid password');
          }
        } else {
          console.log('Invalid credentials:', parsedCredentials.error);
        }

        return null;
      },
    }),
  ],
});

// Exporta la función de registro si la necesitas en otro lugar
export { registerUser };