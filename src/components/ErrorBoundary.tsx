"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/** 描画エラーを局所化する。地球儀などが失敗してもタイマー・記録は動き続ける。 */
export class ErrorBoundary extends Component<{ fallback: ReactNode | ((error: Error) => ReactNode); onError?: (e: Error) => void; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error);
    if (process.env.NODE_ENV !== "production") console.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const fb = this.props.fallback;
      return typeof fb === "function" ? fb(this.state.error) : fb;
    }
    return this.props.children;
  }
}
