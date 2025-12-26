import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilsService {
  // Función para generar un código aleatorio
  private generateRandomFromCharset(length: number, charset: string): string {
    return Array.from({ length }, () =>
      charset.charAt(Math.floor(Math.random() * charset.length)),
    ).join('');
  }

  generateRandomUserCode(
    codeType: 'upper' | 'lower' | 'numeric' | 'random' = 'random',
    length: number = 8,
  ): string {
    const charsets = {
      upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      numeric: '0123456789',
      random: 'abcdefghijklmnopqrstuvwxyz', // o puedes usar upper + lower + numbers si lo prefieres
      mixed: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    };

    const charset =
      codeType === 'random'
        ? charsets.random
        : charsets[codeType] || charsets.mixed;

    let code = this.generateRandomFromCharset(length, charset);

    // Ajustar según tipo (ej: forzar mayúsculas si era "upper")
    if (codeType === 'upper') return code.toUpperCase();
    if (codeType === 'lower') return code.toLowerCase();

    return code;
  }

  toTitleCase(str: string): string {
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
