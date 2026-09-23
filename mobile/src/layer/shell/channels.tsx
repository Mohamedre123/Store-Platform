/**
 * قنوات البيع — شاشة أصلية (`/dashboard/marketing/channels`).
 *
 * نفس صفحة اللوحة (شاشة تشخيص — ما بتحفظش حاجة): «خلّصت X خطوة من Y» بشريط، وكارت لكل قناة بنقطة لونها
 * و«جاهزة» أو X/Y وليه تهمّك، وخطواتها — الناقصة بشرحها وسهم، والدوسة بتوديك للمكان اللي بتتظبط فيه.
 */
import { haptic } from '../bridge'
import { icons } from '../icons'
import { formatNumber } from './format'
import { channelsData } from './growth-api'
import { useResource } from './http'
import { navigate } from './navigate'
import { Screen } from './screen'
import { LoadState } from './settings-forms'
import { Icon } from './ui'

export function ChannelsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(channelsData, visible, onUnavailable)
  const pct = data && data.totals.total ? Math.round((data.totals.done / data.totals.total) * 100) : 0

  return (
    <Screen visible={visible} title="قنوات البيع" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">قنوات البيع</h1>
            <p class="page-sub">كل قناة وإيه اللي ناقصها عندك — والزرار بيوديك للخطوة الناقصة بالظبط.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="قنوات البيع" />
        ) : (
          <>
            <section class="card sec rise">
              <b class="ch-total">
                خلّصت {formatNumber(data.totals.done)} خطوة من {formatNumber(data.totals.total)}
              </b>
              <small class="sg-hint">مش لازم تخلّص كل القنوات — ركّز على اللي بتصرف عليها إعلانات فعلًا.</small>
              <div class="an-track">
                <i style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
            </section>

            {data.channels.map((c) => {
              const complete = c.progress.done === c.progress.total
              return (
                <section key={c.key} class="card sec rise ch-card">
                  <div class="ch-head">
                    <i class="ch-dot" style={{ background: c.color }} aria-hidden="true" />
                    <span>
                      <b>
                        {c.name}
                        <span class={`pst-pill ${complete ? 'pst-pill--good' : 'pst-pill--muted'}`}>
                          {complete ? 'جاهزة' : `${formatNumber(c.progress.done)}/${formatNumber(c.progress.total)}`}
                        </span>
                      </b>
                      <small>{c.why}</small>
                    </span>
                  </div>
                  <div class="ch-steps">
                    {c.steps.map((s) => {
                      const done = s.status === 'done'
                      return (
                        <button
                          key={s.label}
                          type="button"
                          class={`ch-step press${done ? ' ch-step--done' : ''}`}
                          onClick={() => {
                            haptic('LIGHT')
                            navigate(s.href)
                          }}
                        >
                          <span class="ch-check">{done ? <Icon svg={icons.check()} /> : <i />}</span>
                          <span class="ch-step-text">
                            <b>{s.label}</b>
                            {!done && <small>{s.hint}</small>}
                          </span>
                          {!done && <Icon svg={icons.chevronLeft()} className="ic an-chev" />}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </>
        )}
      </div>
    </Screen>
  )
}
