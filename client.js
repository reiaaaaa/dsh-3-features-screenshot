/**
 * 3 features screenshot · browser half.
 *
 * One button in the composer tool row, one shortcut command, and one card that
 * offers the three things people usually want from a screenshot: read the text,
 * translate it, or describe what is on screen.
 *
 * The picker is the platform's own: the Host half launches the system snip UI
 * and answers with the PNG the user picked, which is the only way a selection
 * can reach past this window's edges.
 */
window.__ModuleLoader__.load({
  id: '@reiaaaaa/dsh-3-features-screenshot',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    /** Host route registered by index.js. Document-relative and same-origin. */
    const ENDPOINT = 'api/dsh-shot.snip'
    const COMMAND_ID = 'dsh-shot.capture'
    const NS = 'dshShot'
    /** The composer card the app renders around every input row. */
    const COMPOSER_CARD = '[data-composer-card]'
    /** How long one paste attempt may take before it is tried again. */
    const PASTE_RETRY_MS = 2000
    /** How long a finished screenshot is kept while the composer refuses it. */
    const PASTE_HOLD_MS = 120000
    /** How long the success card stays before it folds away. */
    const DISMISS_MS = 20000
    /** How long a toast stays. */
    const NOTICE_MS = 6000

    const DICTIONARIES = {
      en: {
        'button.label': 'Screenshot',
        'command.label': 'Take a screenshot',
        'state.attached': 'Screenshot ready to send',
        'state.snip': 'Pick a region on the screen…',
        'state.cancelled': 'Screenshot cancelled',
        'state.waiting': 'Inserting the screenshot… it joins the composer as soon as the reply finishes',
        'action.text': 'Read text',
        'action.translate': 'Translate',
        'action.describe': 'Describe',
        'action.close': 'Dismiss',
        'prompt.text': 'Read the text in this screenshot and return it in reading order. Keep the original line breaks; do not translate.',
        'prompt.translate': 'Translate the text in this screenshot. Show the original first, then the translation.',
        'prompt.describe': 'Describe what this screenshot shows.',
        'error.noComposer': 'Open a conversation first, then take the screenshot',
        'error.capture': 'The screenshot could not be taken: {message}',
        'error.paste': 'The screenshot could not be added yet — finish the current reply, then take it again',
        'error.prompt': 'The prompt could not be written into the composer',
        'size': '{width} × {height}',
      },
      zh: {
        'button.label': '截图',
        'command.label': '截取屏幕区域',
        'state.attached': '截图已加入输入框',
        'state.snip': '在屏幕上拖动选择区域…',
        'state.cancelled': '已取消截图',
        'state.waiting': '正在插入截图…回复结束后会自动放进输入框',
        'action.text': '识别文字',
        'action.translate': '翻译',
        'action.describe': '描述内容',
        'action.close': '关闭',
        'prompt.text': '识别这张截图里的文字，按阅读顺序原样返回，保留原有换行，不要翻译。',
        'prompt.translate': '翻译这张截图里的文字，先给出原文，再给出译文。',
        'prompt.describe': '描述这张截图的内容。',
        'error.noComposer': '请先打开一个对话，再截图',
        'error.capture': '截图失败：{message}',
        'error.paste': '截图没能插进输入框：等这条回复结束后再截一次',
        'error.prompt': '提示词没能写进输入框',
        'size': '{width} × {height}',
      },
    }

    const STYLES = `
.dsh-shot__trigger{display:inline-flex;align-items:center;gap:6px;flex:none;height:28px;padding:0 10px 0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1;cursor:pointer}
.dsh-shot__trigger:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1)}
.dsh-shot__trigger:disabled{opacity:.5;cursor:default}
.dsh-shot__trigger-label{white-space:nowrap}
.dsh-shot__layer{position:fixed;inset:0;pointer-events:none;z-index:60}
.dsh-shot__pill{position:fixed;left:50%;top:16px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:min(520px,calc(100vw - 32px));padding:8px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.4;pointer-events:none;box-shadow:0 12px 30px rgba(0,0,0,.28)}
.dsh-shot__spin{flex:none;width:12px;height:12px;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:999px;animation:dsh-shot-spin .8s linear infinite}
@keyframes dsh-shot-spin{to{transform:rotate(360deg)}}
.dsh-shot__card{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;max-width:min(560px,calc(100vw - 32px));padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);pointer-events:auto;box-shadow:0 14px 34px rgba(0,0,0,.3)}
.dsh-shot__thumb{flex:none;display:block;max-width:88px;max-height:60px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;object-fit:cover;background:var(--dsw-alias-bg-layer-2)}
.dsh-shot__card-body{display:flex;flex-direction:column;gap:8px;min-width:0}
.dsh-shot__card-title{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dsh-shot__card-actions{display:flex;flex-wrap:wrap;gap:6px}
.dsh-shot__chip{height:26px;padding:0 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.dsh-shot__chip:hover{background:var(--dsw-alias-bg-layer-1)}
.dsh-shot__close{flex:none;width:24px;height:24px;border:none;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:16px;line-height:1;cursor:pointer}
.dsh-shot__close:hover{background:var(--dsw-alias-bg-layer-2)}
.dsh-shot__toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%);max-width:min(520px,calc(100vw - 32px));padding:9px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.5;pointer-events:auto;box-shadow:0 12px 30px rgba(0,0,0,.28)}
`

    /** Minimal external store: the controller lives outside React, both halves read it. */
    function createStore(initial) {
      let state = initial
      const listeners = new Set()
      return {
        get: () => state,
        set: (patch) => {
          const next = typeof patch === 'function'
            ? patch(state)
            : Array.isArray(patch)
              ? patch
              : { ...state, ...patch }
          state = next
          for (const listener of [...listeners]) listener()
        },
        subscribe: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }
    }

    function useStore(store) {
      const [snapshot, setSnapshot] = useState(() => store.get())
      useEffect(() => {
        setSnapshot(store.get())
        return store.subscribe(() => setSnapshot(store.get()))
      }, [store])
      return snapshot
    }

    const messageOf = (error) => (error instanceof Error ? error.message : String(error))

    const fileStamp = () => {
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    }

    /** Turn a failed response into the text the Host half sent, or a status line. */
    async function failureText(response) {
      const text = await response.text().catch(() => '')
      if (text !== '') {
        try {
          const parsed = JSON.parse(text)
          if (parsed !== null && typeof parsed === 'object' && typeof parsed.error === 'string') return parsed.error
        } catch (error) {
          /* not JSON: fall through to the raw body */
        }
        return text
      }
      return `HTTP ${response.status}`
    }

    /**
     * Hand one file to the composer through the app's document paste route.
     * A synthetic paste is the public path: `document.body` is outside the
     * route's editable check, and the focusin dispatch below tells the router
     * which composer card asked for the file.
     *
     * @param card - the composer card the file belongs to.
     * @param file - the image file to paste.
     */
    function pasteInto(card, file) {
      const transfer = new DataTransfer()
      transfer.items.add(file)
      try {
        card.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }))
      } catch (error) {
        /* the paste below still reaches the main composer */
      }
      const event = new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })
      if (event.clipboardData !== transfer) {
        Object.defineProperty(event, 'clipboardData', { configurable: true, value: transfer })
      }
      document.body.dispatchEvent(event)
    }

    /**
     * Count the attachment thumbnails the composer has painted. Attachment ids
     * only land in the input state after the upload finishes, so the rendered
     * draft is what proves the paste was admitted.
     *
     * @param card - the composer card, or null while it is not mounted.
     * @returns how many thumbnails the card shows.
     */
    function tileCount(card) {
      if (card === null || card === undefined) return 0
      const images = card.querySelectorAll('img').length
      const painted = card.querySelectorAll('[style*="background-image"]').length
      return images + painted
    }

    /** Poll `predicate` until it holds or the timeout expires. */
    async function waitFor(predicate, timeout) {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (predicate()) return true
        await new Promise((resolve) => { setTimeout(resolve, 40) })
      }
      return predicate()
    }

    const CameraIcon = () => h('svg', {
      viewBox: '0 0 24 24',
      width: 15,
      height: 15,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
      h('path', { d: 'M4 8.5h2.6L8 6h8l1.4 2.5H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z' }),
      h('circle', { cx: 12, cy: 13, r: 3.4 }))

    return {
      inject: ['slots', 'locale'],

      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'dsh-shot: dictionaries')
        const t = ctx.locale.bind(NS)


        // ---------------------------------------------------------------- state
        const store = createStore({
          phase: 'idle', // idle | snip | committing | attached
          thumb: null,
          error: null,
          notice: null,
        })
        const keycaps = createStore([])

        /** Every mounted composer, most recent last. */
        const consumers = new Set()
        let preferred = null
        let target = null
        let generating = false
        let thumbUrl = null
        let noticeTimer = null
        let dismissTimer = null

        const clearTimers = () => {
          if (noticeTimer !== null) { clearTimeout(noticeTimer); noticeTimer = null }
          if (dismissTimer !== null) { clearTimeout(dismissTimer); dismissTimer = null }
        }

        const releaseThumb = () => {
          if (thumbUrl !== null) {
            try { URL.revokeObjectURL(thumbUrl) } catch (error) { /* already gone */ }
            thumbUrl = null
          }
        }

        const notice = (message) => {
          if (noticeTimer !== null) clearTimeout(noticeTimer)
          store.set({ notice: message })
          noticeTimer = setTimeout(() => {
            noticeTimer = null
            store.set({ notice: null })
          }, NOTICE_MS)
        }

        const dismiss = () => {
          clearTimers()
          releaseThumb()
          target = null
          store.set({ phase: 'idle', thumb: null, error: null, notice: null })
        }

        /** Which mounted composer receives the result. */
        const pick = (element) => {
          const list = [...consumers]
          const holds = (consumer, node) => {
            if (node === null) return false
            const card = consumer.card()
            return card !== null && card.contains(node)
          }
          if (element !== null && typeof element === 'object' && typeof element.nodeType === 'number') {
            for (const consumer of list) if (holds(consumer, element)) return consumer
          }
          const active = document.activeElement
          for (const consumer of list) if (holds(consumer, active)) return consumer
          if (preferred !== null && consumers.has(preferred) && preferred.card() !== null) return preferred
          for (let index = list.length - 1; index >= 0; index -= 1) {
            if (list[index].card() !== null) return list[index]
          }
          return null
        }

        const peek = (element) => pick(element)

        /** The composer card the result card should sit above. */
        const composerCard = () => {
          const consumer = target !== null && consumers.has(target) ? target : pick(null)
          const card = consumer === null ? null : consumer.card()
          if (card !== null) return card
          return document.querySelector(COMPOSER_CARD)
        }

        /**
         * Where to pin the result card: horizontally centred on the composer it
         * belongs to and floating just above it, so it never covers the chat.
         */
        const composerAnchor = () => {
          const card = composerCard()
          if (card === null || typeof card.getBoundingClientRect !== 'function') return null
          const rect = card.getBoundingClientRect()
          if (rect === null || rect.width <= 0 || rect.height <= 0) return null
          const viewportWidth = Math.max(window.innerWidth, 320)
          const half = Math.min(280, viewportWidth / 2 - 12)
          const centre = Math.min(Math.max(rect.left + rect.width / 2, half), viewportWidth - half)
          const gap = Math.max(12, Math.round(window.innerHeight - rect.top + 10))
          return { centre: Math.round(centre), gap }
        }

        // -------------------------------------------------------------- capture
        /** Ask the Host for one screen snip and hand the result to the composer. */
        const start = async (element) => {
          const state = store.get()
          if (state.phase === 'snip' || state.phase === 'committing') return
          const consumer = pick(element)
          if (consumer === null) {
            notice(t('error.noComposer'))
            return
          }
          if (generating) return
          generating = true
          clearTimers()
          releaseThumb()
          target = consumer
          store.set({ phase: 'snip', thumb: null, error: null, notice: null })
          try {
            const response = await fetch(ENDPOINT, { credentials: 'same-origin', cache: 'no-store' })
            if (!response.ok) throw new Error(await failureText(response))
            const blob = await response.blob()
            if (blob.size === 0) throw new Error('empty image')

            store.set({ phase: 'committing' })
            const file = new File([blob], `screenshot-${fileStamp()}.png`, { type: 'image/png' })
            const before = consumer.count()
            let card = consumer.card() ?? document.querySelector(COMPOSER_CARD)
            const beforeTiles = tileCount(card)
            let accepted = false
            let waited = 0
            // The composer refuses files while a reply streams, so keep the image
            // and retry until a thumbnail appears, instead of throwing the shot
            // away or pasting it twice. Attachment ids lag the visual draft, so a
            // rendered thumbnail is the only reliable admission signal.
            while (!accepted && waited < PASTE_HOLD_MS) {
              pasteInto(card, file)
              accepted = await waitFor(
                () => consumer.count() > before || tileCount(card) > beforeTiles,
                PASTE_RETRY_MS,
              )
              if (accepted) break
              waited += PASTE_RETRY_MS
              card = consumer.card() ?? document.querySelector(COMPOSER_CARD)
              store.set({ notice: t('state.waiting'), phase: 'committing' })
            }
            if (!accepted) {
              const message = t('error.paste')
              dismiss()
              notice(message)
              return
            }
            thumbUrl = URL.createObjectURL(blob)
            store.set({ phase: 'attached', thumb: { url: thumbUrl }, error: null, notice: null })
            if (dismissTimer !== null) clearTimeout(dismissTimer)
            dismissTimer = setTimeout(() => { dismissTimer = null; dismiss() }, DISMISS_MS)
          } catch (error) {
            const detail = messageOf(error)
            dismiss()
            notice(/cancel/i.test(detail) ? t('state.cancelled') : t('error.capture', { message: detail }))
          } finally {
            generating = false
          }
        }

        /** Ask the model for something about the image that is already attached. */
        const insertPrompt = (kind) => {
          const consumer = target
          if (consumer === null) return
          const prompt = t(`prompt.${kind}`)
          const actions = consumer.actions
          try {
            if (actions === null || typeof actions !== 'object') throw new Error('no input actions')
            const draft = consumer.draft()
            if (typeof actions.setDraft === 'function' && (draft === null || draft.trim() === '')) {
              actions.setDraft(prompt)
            } else if (typeof actions.insertText === 'function' && typeof actions.captureInsertion === 'function') {
              const span = actions.captureInsertion()
              if (actions.insertText(prompt, span) === false) throw new Error('insertion refused')
            } else {
              throw new Error('no prompt channel')
            }
            const editable = document.querySelector('[contenteditable="true"]')
            if (editable !== null && typeof editable.focus === 'function') editable.focus()
          } catch (error) {
            notice(t('error.prompt'))
          }
        }

        const register = (consumer) => {
          consumers.add(consumer)
          preferred = consumer
          return () => {
            consumers.delete(consumer)
            if (preferred === consumer) preferred = [...consumers].at(-1) ?? null
          }
        }

        // ------------------------------------------------------------ shortcuts
        const setupShortcuts = (scope) => {
          const shortcuts = typeof scope.get === 'function' ? scope.get('shortcuts') : scope.shortcuts
          if (shortcuts === undefined || shortcuts === null || typeof shortcuts.register !== 'function') return
          const readKeys = () => {
            try {
              const catalog = shortcuts.catalog
              const rows = catalog !== null && typeof catalog === 'object' && typeof catalog.getSnapshot === 'function'
                ? catalog.getSnapshot()
                : []
              const row = Array.isArray(rows) ? rows.find((entry) => entry !== null && entry.id === COMMAND_ID) : undefined
              keycaps.set(row !== undefined && Array.isArray(row.keys) ? row.keys : [])
            } catch (error) {
              keycaps.set([])
            }
          }
          readKeys()
          if (typeof scope.effect === 'function') {
            scope.effect(() => {
              const catalog = shortcuts.catalog
              if (catalog === null || typeof catalog !== 'object' || typeof catalog.subscribe !== 'function') return () => {}
              return catalog.subscribe(readKeys)
            }, 'dsh-shot: shortcut keycaps')
          }
          const binding = { code: 'KeyS', modifiers: ['primary', 'shift'] }
          const command = {
            id: COMMAND_ID,
            label: () => t('command.label'),
            aliases: ['screenshot', 'screen shot', 'capture screen', '截图'],
            // `web:linux` stays unbound: the app's registry only allows web
            // defaults on the windows and macos profiles.
            defaults: {
              'desktop:windows': binding,
              'desktop:macos': binding,
              'desktop:linux': binding,
              'web:windows': binding,
              'web:macos': binding,
            },
            regions: ['page', 'editable', 'terminal'],
            modals: [],
            resolve: (context) => {
              const consumer = pick(context === null || context === undefined ? null : context.target)
              if (consumer === null) return { status: 'blocked', reason: t('error.noComposer') }
              return { status: 'handled', run: () => { start(context === null ? null : context.target) } }
            },
          }
          scope.effect(() => {
            try {
              return shortcuts.register(command)
            } catch (error) {
              console.warn('[dsh-shot] the capture shortcut could not be registered:', messageOf(error))
              return () => {}
            }
          }, 'dsh-shot: capture shortcut')
        }

        // --------------------------------------------------------------- views
        function TriggerView(props) {
          const attachments = props.useInput((state) => state.attachmentIds.length)
          const draft = props.useInput((state) => state.draft)
          const state = useStore(store)
          const keys = useStore(keycaps)
          const button = useRef(null)
          const label = t('button.label')
          // Live values stay in a ref so the consumer object itself never changes
          // identity: a new consumer on every render would re-register the slot
          // occupant on each streamed token.
          const live = useRef({ attachments, draft })
          live.current.attachments = attachments
          live.current.draft = draft

          const consumer = useMemo(() => ({
            sessionId: props.sessionId,
            actions: props.inputActions,
            card: () => button.current?.closest(COMPOSER_CARD) ?? document.querySelector(COMPOSER_CARD),
            count: () => live.current.attachments,
            draft: () => live.current.draft,
          }), [props.sessionId, props.inputActions])

          useEffect(() => register(consumer), [consumer])

          const busy = state.phase !== 'idle'
          const title = keys.length === 0 ? label : `${label} (${String(keys.join(''))})`

          return h('button', {
            ref: button,
            type: 'button',
            className: 'dsh-shot__trigger',
            title,
            'aria-label': title,
            disabled: busy,
            onMouseDown: (event) => { event.preventDefault() },
            onClick: () => { start(button.current) },
          },
            h(CameraIcon, null),
            h('span', { className: 'dsh-shot__trigger-label' }, label))
        }

        function OverlayView() {
          const state = useStore(store)
          const [anchor, setAnchor] = useState(null)
          const parts = []
          const attached = state.phase === 'attached' && state.thumb !== null

          // The card floats above the composer, so it has to follow the composer
          // when the window resizes or the input row grows an attachment row.
          useEffect(() => {
            if (!attached) {
              setAnchor(null)
              return () => {}
            }
            const measure = () => {
              const next = composerAnchor()
              setAnchor((current) => (
                current !== null && next !== null && current.centre === next.centre && current.gap === next.gap
                  ? current
                  : next
              ))
            }
            measure()
            window.addEventListener('resize', measure)
            const card = composerCard()
            let observer = null
            if (card !== null && typeof ResizeObserver === 'function') {
              observer = new ResizeObserver(measure)
              observer.observe(card)
            }
            return () => {
              window.removeEventListener('resize', measure)
              if (observer !== null) observer.disconnect()
            }
          }, [attached])

          if (state.phase === 'snip' || state.phase === 'committing') {
            parts.push(h('div', { key: 'pill', className: 'dsh-shot__pill' },
              h('span', { className: 'dsh-shot__spin' }),
              h('span', null, state.phase === 'snip' ? t('state.snip') : t('state.waiting'))))
          }

          if (attached) {
            parts.push(h('div', {
              key: 'card',
              className: 'dsh-shot__card',
              style: anchor === null
                ? undefined
                : { left: `${anchor.centre}px`, bottom: `${anchor.gap}px` },
            },
              h('img', { className: 'dsh-shot__thumb', src: state.thumb.url, alt: '' }),
              h('div', { className: 'dsh-shot__card-body' },
                h('span', { className: 'dsh-shot__card-title' }, t('state.attached')),
                h('div', { className: 'dsh-shot__card-actions' },
                  h('button', { type: 'button', className: 'dsh-shot__chip', onClick: () => { insertPrompt('text') } }, t('action.text')),
                  h('button', { type: 'button', className: 'dsh-shot__chip', onClick: () => { insertPrompt('translate') } }, t('action.translate')),
                  h('button', { type: 'button', className: 'dsh-shot__chip', onClick: () => { insertPrompt('describe') } }, t('action.describe')))),
              h('button', {
                type: 'button',
                className: 'dsh-shot__close',
                title: t('action.close'),
                'aria-label': t('action.close'),
                onClick: dismiss,
              }, '×')))
          }

          if (state.notice !== null && state.phase !== 'committing') {
            parts.push(h('div', { key: 'notice', className: 'dsh-shot__toast', role: 'status' }, state.notice))
          }

          if (parts.length === 0) return null
          return h('div', { className: 'dsh-shot__layer' }, parts)
        }

        // ----------------------------------------------------------------- slots
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.dshShot = ''
          style.textContent = STYLES
          document.head.append(style)
          return () => { style.remove() }
        }, 'dsh-shot: styles')

        // The shortcut service belongs to the shell, but a plugin may be applied
        // before it exists: wait for it instead of failing the whole button.
        if (typeof ctx.get === 'function' && ctx.get('shortcuts') !== undefined) setupShortcuts(ctx)
        else if (typeof ctx.inject === 'function') ctx.inject(['shortcuts'], (scope) => { setupShortcuts(scope) })

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'dsh-shot.trigger',
          order: 12,
        }, TriggerView))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-shot.overlay',
          order: 40,
        }, OverlayView))

        ctx.effect(() => () => {
          clearTimers()
          releaseThumb()
          consumers.clear()
          preferred = null
          target = null
        }, 'dsh-shot: teardown')

        // The apply callback must not return a value: the client loader
        // disposes a fiber whose plugin factory answers with something else.
        void peek
      },
    }
  },
})
