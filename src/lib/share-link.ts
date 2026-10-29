// リンクを共有する（共有シートがなければクリップボードにコピー）。
import { toast } from "@/store/ui";

export async function shareLink(url: string, text: string): Promise<void> {
  try {
    if (navigator.share) {
      await navigator.share({ url, text });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast("リンクをコピーしました", "success");
  } catch {
    toast("リンクを共有できませんでした", "error");
  }
}
