"use client";

import { LANGS, messages, setLang, useLang } from "@/i18n";

/** 公開ページ用の言語切り替え（URL の ?lang= も書き換える） */
export function LangSwitch() {
  const lang = useLang();
  return (
    <div role="group" aria-label="Language" className="flex rounded-full border border-line p-0.5 text-xs">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("lang", l);
            window.history.replaceState(null, "", url);
            setLang(l);
          }}
          className={`min-h-9 rounded-full px-3 font-semibold ${lang === l ? "bg-ink text-night" : "text-mute"}`}
        >
          {messages(l).meta.langName}
        </button>
      ))}
    </div>
  );
}
