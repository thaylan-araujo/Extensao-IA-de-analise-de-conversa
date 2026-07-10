type InviteEmailInput = {
  inviteUrl: string;
  organizationName: string;
  expiresInDays: number;
};

export function renderInviteEmail({
  inviteUrl,
  organizationName,
  expiresInDays
}: InviteEmailInput) {
  const subject = `Você foi convidado para a equipe ${organizationName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #18181b; line-height: 1.5;">
      <p>Olá,</p>
      <p>Você foi convidado para participar da equipe ${organizationName} no painel da Elite Juris.</p>
      <p>O painel ajuda gestores a acompanhar atendimentos jurídicos, equipe e diagnósticos das conversas.</p>
      <p>
        <a href="${inviteUrl}" style="display: inline-block; background: #047857; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 4px;">
          Aceitar convite
        </a>
      </p>
      <p>Este convite é válido por ${expiresInDays} dias. Depois desse prazo, peça um novo convite ao gestor.</p>
      <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
      <p>Atenciosamente,<br />Elite Juris</p>
    </div>
  `;

  return { subject, html };
}
