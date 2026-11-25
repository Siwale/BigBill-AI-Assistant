# Local Bluetooth companion

The optional Linux companion exposes the machine's BlueZ Bluetooth devices and PipeWire/PulseAudio outputs to the signed-in Aida browser session. It binds only to `127.0.0.1:8787`; it does not provide a remote hardware proxy.

Start it on the same computer and set a private pairing code plus the exact Aida browser origin:

```sh
COMPANION_PAIRING_CODE='choose-a-local-secret' \
COMPANION_ALLOW_ORIGIN='http://localhost:3000' \
pnpm --dir companion dev
```

Open **Devices & Presence**, enter the same pairing code, and choose **Pair companion**. The session expires after 30 minutes and can be revoked with **Disconnect companion**. Use **Discover devices & audio outputs** to inspect actual hardware, then explicitly pair/connect a device or select an audio output.

The pairing control is disabled when the local companion or `bluetoothctl` is unavailable. Bluetooth speakers and headsets require the Linux companion; browser Web Bluetooth only supports BLE GATT and is not an audio-device replacement. Voice and camera permissions remain browser-controlled and user initiated.
