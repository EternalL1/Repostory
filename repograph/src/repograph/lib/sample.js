// A small fictional repo used for demos. Produces text in the same format as GIT_LOG_COMMAND.
const SAMPLE = [
  ['c1', [], 'Ana Reyes', '2026-10-01T09:12:00+08:00', '', 'Initial commit', ['README.md', 'build.gradle.kts', 'settings.gradle.kts']],
  ['c2', ['c1'], 'Ana Reyes', '2026-10-01T14:40:00+08:00', '', 'Set up Jetpack Compose project', ['app/build.gradle.kts', 'app/src/main/MainActivity.kt']],
  ['c3', ['c2'], 'Ben Cruz', '2026-10-02T10:05:00+08:00', '', 'Add staging build variant', ['app/build.gradle.kts']],
  ['c4', ['c3'], 'Ben Cruz', '2026-10-03T21:30:00+08:00', '', 'Add navigation scaffold', ['app/src/main/ui/NavGraph.kt', 'app/src/main/MainActivity.kt']],
  ['f1', ['c4'], 'Carla Santos', '2026-10-05T13:15:00+08:00', '', 'Login screen UI', ['app/src/main/ui/login/LoginScreen.kt']],
  ['g1', ['c4'], 'Dan Lim', '2026-10-05T22:47:00+08:00', '', 'Chart component skeleton', ['app/src/main/ui/chart/ChartView.kt']],
  ['f2', ['f1'], 'Carla Santos', '2026-10-06T15:02:00+08:00', '', 'Login form validation', ['app/src/main/ui/login/LoginScreen.kt', 'app/src/main/ui/login/LoginViewModel.kt']],
  ['e1', ['c4'], 'Ben Cruz', '2026-10-07T23:58:00+08:00', 'feature/old-export', 'Export results to CSV (WIP)', ['app/src/main/data/CsvExporter.kt', 'app/src/main/ui/NavGraph.kt']],
  ['f3', ['f2'], 'Carla Santos', '2026-10-08T11:20:00+08:00', '', 'Hook login to AuthRepository', ['app/src/main/ui/login/LoginViewModel.kt', 'app/src/main/data/AuthRepository.kt']],
  ['g2', ['g1'], 'Dan Lim', '2026-10-09T01:14:00+08:00', '', 'Bar chart rendering', ['app/src/main/ui/chart/ChartView.kt', 'app/src/main/ui/chart/ChartUtils.kt']],
  ['c5', ['c4', 'f3'], 'Ben Cruz', '2026-10-09T16:00:00+08:00', '', "Merge branch 'feature/login' into staging", []],
  ['g3', ['g2'], 'Dan Lim', '2026-10-11T20:33:00+08:00', '', 'Line chart and axis labels', ['app/src/main/ui/chart/ChartView.kt']],
  ['h1', ['c5'], 'Ana Reyes', '2026-10-12T09:45:00+08:00', '', 'Fix crash on empty password', ['app/src/main/ui/login/LoginViewModel.kt']],
  ['c6', ['c5', 'h1'], 'Ben Cruz', '2026-10-12T10:30:00+08:00', '', "Merge branch 'fix/empty-password' into staging", []],
  ['g4', ['g3', 'c6'], 'Dan Lim', '2026-10-13T19:10:00+08:00', '', "Merge branch 'staging' into feature/charts", ['app/src/main/ui/chart/ChartView.kt']],
  ['g5', ['g4'], 'Dan Lim', '2026-10-15T22:05:00+08:00', '', 'Chart tooltips', ['app/src/main/ui/chart/ChartView.kt', 'app/src/main/ui/chart/ChartUtils.kt']],
  ['c7', ['c6', 'g5'], 'Ben Cruz', '2026-10-16T14:00:00+08:00', '', "Merge branch 'feature/charts' into staging", []],
  ['m1', ['c2', 'c7'], 'Ana Reyes', '2026-10-17T10:00:00+08:00', 'HEAD -> main, tag: v0.1', "Merge branch 'staging' into main", ['README.md']],
  ['c8', ['c7'], 'Carla Santos', '2026-10-20T15:25:00+08:00', '', 'Settings screen', ['app/src/main/ui/settings/SettingsScreen.kt', 'app/src/main/ui/NavGraph.kt']],
  ['d1', ['c8'], 'Dan Lim', '2026-10-22T21:40:00+08:00', '', 'Dark mode toggle', ['app/src/main/ui/settings/SettingsScreen.kt', 'app/src/main/ui/theme/Theme.kt']],
  ['c9', ['c8'], 'Ben Cruz', '2026-10-23T11:11:00+08:00', 'staging, origin/staging', 'Refactor MainActivity into screens', ['app/src/main/MainActivity.kt', 'app/src/main/ui/NavGraph.kt']],
  ['d2', ['d1'], 'Dan Lim', '2026-10-24T00:30:00+08:00', 'feature/dark-mode', 'Persist theme preference', ['app/src/main/ui/theme/Theme.kt', 'app/src/main/data/PrefsStore.kt']],
]

export const SAMPLE_NAME = 'sample-android-app'

function fakeHash(id) {
  let h = 2166136261
  let out = ''
  for (let k = 0; k < 5; k++) {
    for (const ch of `${id}:${k}`) {
      h ^= ch.charCodeAt(0)
      h = Math.imul(h, 16777619) >>> 0
    }
    out += h.toString(16).padStart(8, '0')
  }
  return out
}

export function sampleLogText() {
  return SAMPLE.slice()
    .reverse()
    .map(([id, parents, author, date, refs, subject, files]) =>
      `@@${fakeHash(id)}|${parents.map(fakeHash).join(' ')}|${author}|${date}|${refs}|${subject}` +
      (files.length ? `\n${files.join('\n')}` : ''),
    )
    .join('\n\n')
}
