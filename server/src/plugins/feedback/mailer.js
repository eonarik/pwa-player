// server/src/plugins/feedback/mailer.js

import nodemailer from 'nodemailer'
import { logger } from '../../shared/logger.js'

let transporter = null

function getTransporter() {
  if (transporter) return transporter

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.yandex.ru',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  return transporter
}

/**
 * Отправляет письмо обратной связи.
 *
 * @param {{ message: string, email?: string, yandexAuthenticated: boolean }} payload
 */
export async function sendFeedbackMail(payload) {
  const to = process.env.FEEDBACK_TO
  if (!to) {
    throw new Error('FEEDBACK_TO is not configured')
  }

  const lines = [
    `Сообщение:`,
    payload.message,
    '',
    `Email: ${payload.email || '—'}`,
    `Яндекс.Диск подключён: ${payload.yandexAuthenticated ? 'да' : 'нет'}`,
    `Время: ${new Date().toISOString()}`,
  ]

  const info = await getTransporter().sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: 'CUEI Media Player — обратная связь',
    text: lines.join('\n'),
  })

  logger.info(`[feedback] mail sent: ${info.messageId}`)
  return info
}
