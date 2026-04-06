import { useEffect, useState } from 'react'

import QRCodeGenerator from '../components/QRCodeGenerator'
import ToolPageLayout from '../components/layout/ToolPageLayout'
import HelpAccordion from '../components/ui/HelpAccordion'
import ToolHeroCompact from '../components/ui/ToolHeroCompact'
import { QR_SECRET_HASH_PREFIX, readSecretPayloadFromQrHash } from '../lib/qr-secret'

export default function QrSecretPage() {
  const [incomingHashPayload, setIncomingHashPayload] = useState<string | null>(null)
  const [incomingHashError, setIncomingHashError] = useState<string | null>(null)

  useEffect(() => {
    function syncQrHash() {
      try {
        setIncomingHashPayload(readSecretPayloadFromQrHash(window.location.hash))
        setIncomingHashError(null)
      } catch (error) {
        setIncomingHashPayload(null)
        setIncomingHashError(
          error instanceof Error
            ? error.message
            : 'Não foi possível interpretar a mensagem protegida presente na URL do QR.',
        )
      }
    }

    syncQrHash()
    window.addEventListener('hashchange', syncQrHash)
    return () => window.removeEventListener('hashchange', syncQrHash)
  }, [])

  function handleClearIncomingHash() {
    if (window.location.hash.startsWith(QR_SECRET_HASH_PREFIX)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }

    setIncomingHashPayload(null)
    setIncomingHashError(null)
  }

  return (
    <ToolPageLayout>
      <div className="space-y-6">
        <ToolHeroCompact
          eyebrow="QR protegido"
          title="Crie um QR com mensagem protegida por senha."
          description="Escreva a mensagem, defina a senha e gere o QR em uma tela simples e direta."
        />

        <QRCodeGenerator
          compact
          incomingHashPayload={incomingHashPayload}
          incomingHashError={incomingHashError}
          onClearIncomingHash={handleClearIncomingHash}
        />

        <HelpAccordion
          items={[
            {
              title: 'Como funciona',
              content:
                'Escreva a mensagem, defina a senha e gere o QR. Ao escanear um QR novo, o site abre com a mensagem já carregada e basta digitar a senha.',
            },
            {
              title: 'Compatibilidade',
              content:
                'QRs novos abrem o site automaticamente. QRs antigos com o texto protegido direto continuam funcionando ao enviar a imagem.',
            },
            {
              title: 'Privacidade',
              content:
                'Tudo acontece no navegador. Nenhum texto ou imagem sai do seu dispositivo.',
            },
          ]}
        />
      </div>
    </ToolPageLayout>
  )
}
