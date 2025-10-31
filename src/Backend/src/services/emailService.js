import nodemailer from 'nodemailer';

/**
 * Serviço de E-mail com fallback automático:
 * - Se .env (EMAIL_HOST) estiver definido: Usa SMTP real (Mailtrap).
 * - Se não: Simula envio no console (modo dev).
 */

export async function sendResetEmail(toEmail, userName, resetLink) {
  // Verificamos se as credenciais do SMTP (Mailtrap) estão definidas no .env
  const useRealSmtp = !!process.env.EMAIL_HOST;

  // Se NÃO estiverem definidas, simulamos no console.
  if (!useRealSmtp) {
    console.warn(`\n[DEV] Variáveis SMTP (EMAIL_HOST) não definidas no .env.`);
    console.warn(`[DEV] Simulando envio de e-mail para: ${toEmail}`);
    console.warn(`[DEV] Nome: ${userName}`);
    console.warn(`[DEV] Link de redefinição: ${resetLink}\n`);
    return { ok: true, simulated: true };
  }

  // ✅ Se as variáveis ESTÃO definidas, usamos o SMTP real (Mailtrap).
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    // secure: true é geralmente para a porta 465. Mailtrap usa STARTTLS (secure: false)
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // --- ADICIONADO: Timeouts para falhar mais rápido (5 segundos) ---
    connectionTimeout: 5000, // Tempo máximo para conectar
    socketTimeout: 5000,     // Tempo máximo para enviar os dados
    // -------------------------------------------------------------
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Lideranças Empáticas" <no-reply@app.com>',
    to: toEmail,
    subject: 'Redefinição de Senha - Lideranças Empáticas',
    text: `Olá ${userName},\n\nAcesse este link para redefinir sua senha:\n${resetLink}\n\nEste link expira em 1 hora.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2 style="color: #2e7d32;">Lideranças Empáticas</h2>
        <p>Olá, <strong>${userName}</strong>,</p>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p style="margin: 25px 0;">
          <a href="${resetLink}" style="background:#2e7d32;color:#ffffff;padding:12px 20px;border-radius:5px;text-decoration:none;font-weight:bold;">
            Redefinir Senha
          </a>
        </p>
        <p style="font-size: 0.9em; color: #777;">Se você não solicitou isso, pode ignorar este e-mail.</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 0.9em; color: #777;">Link (para copiar e colar):<br>${resetLink}</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] E-mail enviado para ${toEmail} via Mailtrap (ID: ${info.messageId})`);
    return { ok: true };
  } catch (error) {
    console.error(`[Email Service] Falha ao enviar e-mail para ${toEmail}:`, error);
    // Mesmo que falhe, em dev, mostramos o link para não bloquear o teste
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[DEV] Falha de SMTP! Simulando link: ${resetLink}`);
      return { ok: true, simulated: true };
    }
    throw new Error('Falha ao enviar e-mail.');
  }
}

