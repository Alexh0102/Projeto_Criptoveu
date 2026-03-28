import ToolPageLayout from '../layout/ToolPageLayout'
import ToolHeroCompact from '../ui/ToolHeroCompact'

type InfoItem = {
  title: string
  description: string
}

type InfoSection = {
  title: string
  description?: string
  items: InfoItem[]
}

type Props = {
  eyebrow: string
  title: string
  description: string
  sections: InfoSection[]
}

export default function InfoPage({ eyebrow, title, description, sections }: Props) {
  return (
    <ToolPageLayout>
      <div className="space-y-6">
        <ToolHeroCompact eyebrow={eyebrow} title={title} description={description} />

        {sections.map((section) => (
          <section key={section.title} className="surface-secondary rounded-[32px] p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">{section.title}</h2>
            {section.description ? (
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
                {section.description}
              </p>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {section.items.map((item) => (
                <div key={item.title} className="surface-technical rounded-[24px] p-5">
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-zinc-400">{item.description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ToolPageLayout>
  )
}