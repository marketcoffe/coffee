// Check key lengths
function base64UrlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// VAPID public key from .env
const vapidPub = 'BAOKT_pwrCIAoinOLCW7z6HErTIm5oElAOuvpPzbJvi4yyvi4Z2lpSJVDkwruZF2wITXqQDI250Wbqutu-a6sj0';
const vapidPubBytes = base64UrlDecode(vapidPub);
console.log('VAPID public key length:', vapidPubBytes.length, '(expected 65 for uncompressed EC point)');
console.log('First byte:', vapidPubBytes[0].toString(16), '(expected 04 for uncompressed)');

// Subscription keys (from DB)
const subP256dh = 'BFoUQeSjMwK9MQPmwLON5Gf_7OMfFzfLkMWtF3JXx4-JiHp6vOb_kFdH9xGRgjUCGPKNIpF6T0wJ2NGtLSVmaEk';
const subAuth = 'aBsWEK1Z0gZsIkgKq4t2Mw';
const p256dhBytes = base64UrlDecode(subP256dh);
const authBytes = base64UrlDecode(subAuth);
console.log('\nSubscription p256dh length:', p256dhBytes.length, '(expected 65 for uncompressed EC point)');
console.log('First byte:', p256dhBytes[0].toString(16), '(expected 04 for uncompressed)');
console.log('Subscription auth length:', authBytes.length, '(expected 16)');
