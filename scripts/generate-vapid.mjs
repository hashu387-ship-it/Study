// Prints a new VAPID key pair for web push. Put the values in .env.local and in Vercel.
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
