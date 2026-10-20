# 📱 WhatsApp Reminder Mobile App (Classic & Modern Edition)

Direct WhatsApp Web Connection ke saath powerful Mobile Web Application (PWA).

---

## ✨ Naye Features

1. **⚡ 1-Tap Quick Save Mode (Expanded Timings):**
   - Sirf message likhein aur kisi bhi button par tap karke save karein:
     - `+5 Min`, `+10 Min`, `+15 Min`, `+30 Min`, `+45 Min`, `+1 Ghanta`, `+2 Ghante`, `+3 Ghante`, `+6 Ghante`
     - `🌙 Aaj Raat 9 PM`, `☀️ Kal Subah 8 AM`, `🏢 Kal Subah 10 AM`, `🌆 Kal Shaam 6 PM`, `🗓️ 2 Din Baad`, `📅 Agla Somwar`
2. **🔁 Rozana (Daily Fix Time) Reminders:**
   - Rozana ek fix time par message paayein (jaise roz subah 8 AM dawa ke liye).
   - **End Date Option:** "Hamesha" chale ya "Kisi fix date tak" (jaise 31 October tak roz aana chahiye, fir apne aap band ho jaye).
3. **🌓 Dark & Light Mode Toggle:**
   - Header me `☀️ / 🌙` button se ek click me Dark ya Light mode chunein.
4. **🔔 Phone Me Loud Ring & Push Notification:**
   - Sender Account aur Recipient Account alag hain.
   - Dusre number se QR scan karke apna main number daalne par incoming WhatsApp ringtone aur popup banner aayega!
5. **🎙️ Voice Mic Support:**
   - Hindi / Hinglish me bolkar message type kar sakte hain.

---

## 🔒 Security Notice & Secret Rotation Warning (IMPORTANT)

> [!WARNING]
> **CRITICAL: Rotate Previously Hardcoded Secrets Immediately**
> If any secret or credential (such as VAPID keys, JWT secret, Razorpay API credentials, or initial passwords) was previously committed to git history, that historical commit still retains the plain text value.
> 
> **Immediate Action Items:**
> 1. **Rotate VAPID Keys:** Generate a new public/private key pair using `npx web-push generate-vapid-keys` and set them in your deployment environment variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
> 2. **Rotate JWT Signing Secret:** Generate a new secure 64-character secret and set it in your deployment environment as `JWT_SECRET`.
> 3. **Rotate Razorpay Keys:** If real Razorpay keys were ever committed, rotate them inside your Razorpay Dashboard.
> 4. **Use Environment Variables Exclusively:** All secrets must now be set via `.env` (locally) or your production host environment settings (e.g. Render, Railway, Vercel). NEVER commit real secrets to Git. See `.env.example` for the full template.

---

## 🚀 Kaise Chalayein?
Folder me jakar **`start.bat`** par double click karein.
- **Computer par:** [http://localhost:3000](http://localhost:3000)
- **Phone par:** `http://10.146.102.11:3000`
