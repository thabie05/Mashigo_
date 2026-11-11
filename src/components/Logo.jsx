// Brand logo: black wordmark in light mode, white glowing wordmark in dark mode.
// Both files are transparent PNGs, so they sit cleanly on any card colour.
export default function Logo({ className = 'h-12' }) {
  return (
    <>
      <img
        src="/logo-light.png"
        alt="B. Mashilo Designs"
        className={`${className} w-auto object-contain dark:hidden`}
      />
      <img
        src="/logo-dark.png"
        alt="B. Mashilo Designs"
        className={`${className} w-auto object-contain hidden dark:block drop-shadow-[0_0_6px_rgba(255,255,255,0.75)] drop-shadow-[0_0_18px_rgba(255,255,255,0.35)]`}
      />
    </>
  );
}
