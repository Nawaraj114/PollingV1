export function ModuleLoading({ cards = 3 }: { cards?: number }) {
  return (
    <main
      aria-busy="true"
      aria-label="Loading page"
      className="mx-auto max-w-6xl animate-pulse px-5 py-10 sm:px-8 sm:py-14"
    >
      <div className="flex items-end justify-between gap-6">
        <div className="w-full max-w-xl">
          <div className="h-6 w-40 rounded-full bg-[#e1e3e6]" />
          <div className="mt-5 h-11 w-52 rounded-2xl bg-[#d9dce0] sm:h-14 sm:w-72" />
          <div className="mt-3 h-6 w-full rounded-xl bg-[#e4e6e9]" />
        </div>
        <div className="hidden h-12 w-36 rounded-full bg-[#d9dce0] sm:block" />
      </div>
      <div className="mt-10 grid gap-5">
        {Array.from({ length: cards }, (_, index) => (
          <div
            className="rounded-[1.6rem] border border-black/5 bg-white p-6"
            key={index}
          >
            <div className="flex justify-between gap-6">
              <div className="w-full">
                <div className="h-5 w-28 rounded-full bg-[#e8e9eb]" />
                <div className="mt-4 h-7 w-2/3 rounded-xl bg-[#dde0e3]" />
                <div className="mt-3 h-4 w-1/2 rounded-lg bg-[#ececef]" />
              </div>
              <div className="h-10 w-24 shrink-0 rounded-xl bg-[#e5e7e9]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
