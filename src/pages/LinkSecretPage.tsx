import { useEffect, useState } from 'react'

import AutoDestructLink from '../components/AutoDestructLink'
import ToolPageLayout from '../components/layout/ToolPageLayout'
import HelpAccordion from '../components/ui/HelpAccordion'
import ToolHeroCompact from '../components/ui/ToolHeroCompact'
import {
  readAutoDestructPayloadFromHash,
  type AutoDestructReadResult,
} from '../lib/auto-destruct-link'

export default function LinkSecretPage() {
  const [incomingHashMessage, setIncomingHashMessage] = useState<AutoDestructReadResult | null>(
    null,
  )
  const [incomingHashError, setIncomingHashError] = useState<string | null>(null)

  useEffect(() => {
    function syncAutoDestructHash() {
      try {
        setIncomingHashMessage(readAutoDestructPayloadFromHash(window.location.hash))
        setIncomingHashError(null)
      } catch (error) {
        setIncomingHashMessage(null)
        setIncomingHashError(
          error instanceof Error
            ? error.message
            : 'Não foi possível interpretar a mensagem secreta presente na URL.',
        )
      }
    }

    syncAutoDestructHash()
    window.addEventListener('hashchange', syncAutoDestructHash)
    return () => window.removeEventListener('hashchange', syncAutoDestructHash)
  }, [])

  function handleClearIncomingHash() {
    if (window.location.hash.startsWith('#msg=')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }

    setIncomingHashMessage(null)
    setIncomingHashError(null)
  }

  return (
    <ToolPageLayout>
      <div className="space-y-6">
        <ToolHeroCompact
          eyebrow="Link secreto"
          title="Crie ou abra um link com mensagem protegida."
          description="Use uma tela dedicada para gerar um link secreto ou abrir um link recebido com mais clareza."
        />

        <AutoDestructLink
          compact
          incomingHashMessage={incomingHashMessage}
          incomingHashError={incomingHashError}
          onClearIncomingHash={handleClearIncomingHash}
        />

        <HelpAccordion
          items={[
            {
              title: 'Como funciona',
              content:
                'Escreva a mensagem, defina a senha e gere o link. Para abrir, cole a URL ou use o hash recebido.',
            },
            {
              title: 'Compatibilidade com links antigos',
              content:
                'Links antigos com #msg continuam funcionando nesta rota.',
            },
          ]}
        />
      </div>
    </ToolPageLayout>
  )
}
