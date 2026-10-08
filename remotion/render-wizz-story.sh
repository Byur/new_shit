#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
composition="WizzSkillKeeperStory"
out_dir="output/wizz-skill-keeper-story"
mkdir -p "$out_dir"

ranges=(
  "0-599"
  "600-1199"
  "1200-1799"
  "1800-2399"
  "2400-2999"
  "3000-3599"
  "3600-4199"
  "4200-4799"
  "4800-5399"
  "5400-5999"
  "6000-6419"
)

for index in "${!ranges[@]}"; do
  part=$(printf "%02d" "$index")
  npx remotion render src/index.ts "$composition" "$out_dir/part-$part.mp4" \
    --frames="${ranges[$index]}" \
    --browser-executable "$chrome" \
    --disable-headless \
    --concurrency=1 \
    --timeout=120000
done

npx remotion ffmpeg -y \
  -f concat \
  -safe 0 \
  -i "$out_dir/parts.txt" \
  -c copy \
  "$out_dir/wizz-skill-keeper-story.mp4"
