/**
 * 客室の窓から外を見る演出。中央の窓だけ地図が見え、周囲は客室の壁で覆う（独自デザイン）。
 */
export function WindowFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center pb-[16vh] short:pb-[10vh]" aria-hidden>
      {/* 窓の開口部。巨大な影で周囲を壁色に塗る */}
      <div
        className="relative overflow-hidden"
        style={{
          width: "min(64vw, 40vh)",
          height: "min(88vw, 56vh)",
          borderRadius: "46% / 34%",
          boxShadow: "0 0 0 200vmax #0b1220, inset 0 0 0 10px #c9d2e2, inset 0 0 0 14px #8d99ae, inset 0 0 40px 18px rgba(0,0,0,0.55)",
        }}
      >
        {/* 下ろしかけのシェード */}
        <div className="absolute inset-x-0 top-0 h-[14%] bg-gradient-to-b from-[#dfe5ef] to-[#b7c0cf] shadow-[0_4px_10px_rgba(0,0,0,0.35)]" />
      </div>
      {/* 窓まわりのパネルの縁 */}
      <div
        className="absolute"
        style={{
          width: "calc(min(64vw, 40vh) + 72px)",
          height: "calc(min(88vw, 56vh) + 88px)",
          marginBottom: "16vh",
          borderRadius: "46% / 34%",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 60px rgba(0,0,0,0.6)",
          background: "radial-gradient(ellipse at 50% 30%, rgba(102,179,255,0.05), transparent 60%)",
        }}
      />
    </div>
  );
}
