export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic imports keep pg-boss and workers out of the Edge runtime bundle.
    const { getBoss } = await import("./lib/queue/index.js");
    const { registerWorkers } = await import("./lib/queue/workers.js");
    const { register: registerEbaySync } = await import("./jobs/ebay-sync.js");
    const { registerAmazonWorkers } = await import("./jobs/amazon-sync.js");

    const boss = await getBoss();
    await registerWorkers(boss);
    await registerEbaySync(boss);
    await registerAmazonWorkers(boss);
  }
}
