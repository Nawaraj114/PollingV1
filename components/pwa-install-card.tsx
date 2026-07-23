"use client";

import { CheckCircle2, Download, Share2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

type InstallState = "checking" | "installed" | "ios" | "browser";

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

function currentInstallState(): InstallState {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as StandaloneNavigator).standalone === true;

  if (standalone) return "installed";

  const ios =
    /iPad|iPhone|iPod/u.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return ios ? "ios" : "browser";
}

export function PwaInstallCard() {
  const [installState, setInstallState] =
    useState<InstallState>("checking");

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateState = () => setInstallState(currentInstallState());

    updateState();
    displayMode.addEventListener("change", updateState);
    window.addEventListener("appinstalled", updateState);

    return () => {
      displayMode.removeEventListener("change", updateState);
      window.removeEventListener("appinstalled", updateState);
    };
  }, []);

  return (
    <section className="mt-6 rounded-[1.7rem] border border-black/7 bg-white p-6 shadow-[0_10px_35px_rgba(34,37,43,0.04)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">
            Install FriendCircle
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a7d85]">
            Add FriendCircle to your home screen for a standalone app window
            and quicker access.
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#edf5ff] text-[#1473e6]">
          <Smartphone size={20} aria-hidden="true" />
        </span>
      </div>

      {installState === "checking" && (
        <p className="mt-6 text-sm text-[#858890]" role="status">
          Checking installation status…
        </p>
      )}

      {installState === "installed" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#eaf8ee] px-4 py-4 text-[#34784c]">
          <CheckCircle2 className="mt-0.5 shrink-0" size={19} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Installed on this device</p>
            <p className="mt-1 text-sm leading-6 text-[#4d765b]">
              Open FriendCircle from your home screen or app launcher.
            </p>
          </div>
        </div>
      )}

      {installState === "ios" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f7f9fc] px-4 py-4">
          <Share2 className="mt-0.5 shrink-0 text-[#1473e6]" size={19} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Install on iPhone or iPad</p>
            <p className="mt-1 text-sm leading-6 text-[#74777f]">
              In Safari, tap Share and choose <strong>Add to Home Screen</strong>.
            </p>
          </div>
        </div>
      )}

      {installState === "browser" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#f7f9fc] px-4 py-4">
          <Download className="mt-0.5 shrink-0 text-[#1473e6]" size={19} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Install from your browser</p>
            <p className="mt-1 text-sm leading-6 text-[#74777f]">
              Use the install icon in the address bar, or open the browser menu
              and choose <strong>Install app</strong> or{" "}
              <strong>Add to Home screen</strong>.
            </p>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-[#92959d]">
        An internet connection is still required for bills, payments, polls,
        balances, and account changes.
      </p>
    </section>
  );
}
