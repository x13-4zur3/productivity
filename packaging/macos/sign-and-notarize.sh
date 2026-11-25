#!/bin/bash
# Requires a Developer ID Application identity and a notarytool Keychain profile.
set -euo pipefail

if [[ $# != 4 || $(uname -s) != Darwin ]]; then
    echo 'On macOS, run: bash packaging/macos/sign-and-notarize.sh <identity> <keychain-profile> <input.dmg> <output.dmg>' >&2
    exit 2
fi
identity=$1
profile=$2
input=$3
output=$4
script_dir=$(cd "$(dirname "$0")" && pwd)

if [[ ! -f "$input" || -e "$output" || "$output" != *.dmg ]]; then
    echo 'Choose an existing input disk image and a new output path ending in .dmg.' >&2
    exit 2
fi

work=$(mktemp -d "${TMPDIR:-/tmp}/productivity-sign.XXXXXXXX")
mountpoint="$work/mounted"
mounted=false
cleanup() {
    if $mounted && ! hdiutil detach "$mountpoint" >&2; then
        echo "Detach $mountpoint manually before removing $work." >&2
        return
    fi
    rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$mountpoint" "$work/image"
hdiutil attach "$input" -readonly -nobrowse -mountpoint "$mountpoint"
mounted=true
app="$work/image/Productivity.app"
ditto "$mountpoint/Productivity.app" "$app"
hdiutil detach "$mountpoint"
mounted=false

xcrun clang -arch arm64 -arch x86_64 -mmacosx-version-min=11.0 -O2 \
    "$script_dir/launcher.c" -o "$app/Contents/MacOS/Productivity"

# Sign the runtime libraries and executable helpers before the outer bundle.
while IFS= read -r -d '' binary; do
    case "$(file -b "$binary")" in
        *Mach-O*executable*)
            codesign --force --timestamp --options runtime --sign "$identity" "$binary"
            ;;
        *Mach-O*)
            codesign --force --timestamp --sign "$identity" "$binary"
            ;;
    esac
done < <(find "$app/Contents/Resources/runtime-aarch64" "$app/Contents/Resources/runtime-x86_64" -type f -print0)

codesign --force --timestamp --options runtime --sign "$identity" "$app"
codesign --verify --deep --strict --verbose=2 "$app"
"$app/Contents/MacOS/Productivity" --help

ln -s /Applications "$work/image/Applications"
image="$work/Productivity.dmg"
hdiutil create -volname Productivity -srcfolder "$work/image" -format UDZO "$image"
codesign --timestamp --sign "$identity" "$image"
xcrun notarytool submit "$image" --keychain-profile "$profile" --wait
xcrun stapler staple "$image"
xcrun stapler validate "$image"
spctl --assess --type open --context context:primary-signature --verbose=2 "$image"

mkdir -p "$(dirname "$output")"
mv -n "$image" "$output"
if [[ -e "$image" ]]; then
    echo 'The output path was created during notarization. Choose a new output path.' >&2
    exit 1
fi
printf 'Signed and notarized disk image: %s\n' "$output"
