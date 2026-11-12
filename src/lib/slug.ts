import { customAlphabet } from 'nanoid';

// No look-alike characters (0/O, 1/l) so short links are easy to read off a flyer.
export const newSlug = customAlphabet('23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ', 7);
