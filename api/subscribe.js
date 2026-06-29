export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const { email } = req.body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido' })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Forneria Tech <noreply@forneriatech.com.br>',
      to: 'contato@forneriatech.com.br',
      subject: 'Novo interesse no Forneria Tech',
      html: `<p>Um novo e-mail foi cadastrado na página de lançamento:</p><p><strong>${email}</strong></p>`,
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Erro ao enviar e-mail' })
  }

  return res.status(200).json({ ok: true })
}
