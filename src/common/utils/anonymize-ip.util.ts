/**
 * Anonymize IP addresses for GDPR-compliant logging.
 *
 * - IPv4: zero out the last octet (e.g. 192.168.1.100 → 192.168.1.0)
 * - IPv6: zero out the last 80 bits (e.g. 2001:0db8:85a3:0000:0000:8a2e:0370:7334 → 2001:0db8:85a3::)
 * - Returns null for null/undefined input.
 */
export function anonymizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;

  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
    return ip;
  }

  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 3).join(':') + '::';
    }
    return ip;
  }

  return ip;
}
