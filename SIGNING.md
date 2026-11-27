# Sign and distribute Productivity

## macOS Developer ID signing and notarization

Use a Mac with current Xcode tools and an Apple Developer Program membership. In Xcode’s **Settings → Accounts → Manage Certificates**, create or install a **Developer ID Application** certificate for your team. The certificate and its private key must be in Keychain. Generate an app-specific password for your Apple Account to use with `notarytool`. [Apple’s signing guide](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac) · [Apple Account app-specific passwords](https://support.apple.com/en-us/102654)

1. Open Terminal in the extracted `Productivity` folder. Confirm the tools are installed and find your exact signing identity.

   ```sh
   xcrun notarytool --version
   xcrun clang --version
   security find-identity -v -p codesigning
   ```

   If `xcrun` cannot find the tools, select your Xcode installation in **Xcode → Settings → Locations → Command Line Tools**. Look for an identity named `Developer ID Application: Your Name (TEAMID)`.

2. Store a notarization profile in Keychain. Replace the email and team ID with your own, then enter the app-specific password when prompted. [Apple’s Keychain and `notarytool` workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)

   ```sh
   xcrun notarytool store-credentials Productivity-notary \
     --apple-id you@example.com --team-id YOUR_TEAM_ID
   ```

3. Run the signing script against the unsigned disk image in `dist/`, using the identity from step 1.

   ```sh
   bash packaging/macos/sign-and-notarize.sh \
     "Developer ID Application: Your Name (TEAMID)" \
     Productivity-notary \
     dist/Productivity-macOS.dmg \
     dist/Productivity-macOS-signed.dmg
   ```

   The script mounts the original image read-only and stages a copy of the app. It builds a universal native launcher, signs the executable code in both Python runtimes and the app with secure timestamps, and enables Hardened Runtime for executables. It signs a fresh disk image, submits it with `notarytool`, staples the ticket, and verifies the result before saving it. [Apple’s notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)

4. If the submission comes back `Invalid`, use the submission ID printed in Terminal to fetch the report. [Apple’s troubleshooting guide](https://developer.apple.com/documentation/security/resolving-common-notarization-issues)

   ```sh
   xcrun notarytool log SUBMISSION_ID \
     --keychain-profile Productivity-notary notarization-log.json
   ```

5. Verify the ticket and test the downloaded image on an Apple silicon and Intel Mac before distributing it.

   ```sh
   xcrun stapler validate dist/Productivity-macOS-signed.dmg
   spctl --assess --type open --context context:primary-signature \
     --verbose=2 dist/Productivity-macOS-signed.dmg
   ```

   When running the importer manually with a bundled Python runtime from a signed `.app`, pass `-B` before `import_browser_data.py` to keep Python’s bytecode cache out of the signed bundle.

## Windows Authenticode signing

Install SignTool from the Windows SDK and use your code-signing certificate. This example finds the certificate in the Windows certificate store by thumbprint. For a hardware token or cloud signing service, use your provider’s signing options and RFC 3161 timestamp URL. [Microsoft SignTool documentation](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool)

```bat
copy dist\Productivity-Setup-x64.exe dist\Productivity-Setup-x64-signed.exe
signtool sign /sha1 YOUR_CERTIFICATE_THUMBPRINT /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 dist\Productivity-Setup-x64-signed.exe
signtool verify /pa /v dist\Productivity-Setup-x64-signed.exe
```

These commands sign the setup EXE. To sign the uninstaller as well, configure NSIS `!uninstfinalize` to call your signing command during the installer build, then sign the finished setup EXE. [NSIS build commands](https://nsis.sourceforge.io/Docs/Chapter5.html#uninstfinalize)

## Linux release signing

For direct downloads, make a detached OpenPGP signature and distribute it with the package. Recipients can verify it using your public key. For an APT repository, sign the repository metadata. [GnuPG commands](https://www.gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html) · [Debian Secure APT](https://wiki.debian.org/SecureApt)

```sh
gpg --armor --detach-sign dist/productivity_1.1.0_all.deb
gpg --verify dist/productivity_1.1.0_all.deb.asc dist/productivity_1.1.0_all.deb
```

Use the same `gpg` commands with `dist/Productivity-Linux.tar.gz` to sign the portable archive.

## Bundle the signed release

After signing, make a separate release ZIP. Include the overrides for the files you signed. Without an override, the bundler uses the corresponding installer in `dist/`.

```sh
python3 packaging/build_bundle.py \
  --macos-dmg dist/Productivity-macOS-signed.dmg \
  --windows-setup dist/Productivity-Setup-x64-signed.exe \
  --output dist/Productivity-1.1.0-signed.zip
```

Use `--deb-signature dist/productivity_1.1.0_all.deb.asc` or `--portable-signature dist/Productivity-Linux.tar.gz.asc` to include detached signatures. On Windows, `py -3` can replace `python3`. Staple the macOS disk image before adding it to the ZIP. Keep certificate private keys and notary credentials in their credential stores.
