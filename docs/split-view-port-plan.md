# Split View(멀티 패널) 기능 — migration/upstream-sync 이식 계획

> **상태: 이식 완료·검증됨 (2026-06-11)**. 실제 클릭으로 1→3패널 균등 분할(각 440px), index 유지, MMKV 영속화까지 CDP로 확인.
> 계획 대비 변경: `SessionsList` 외에 **`ActiveSessionsGroupCompact.tsx`**(사이드바 상단 활성 세션 그룹)에도 동일 클릭 배선 필요했음 — 사이드바 세션 클릭 경로는 이 2곳이 전부(`navigateToSession` 호출처 전수 확인).
> 빌드 주의: 실행 중인 app.exe를 종료하지 않고 빌드하면 cargo가 exe 교체에 실패해도 빌드가 성공처럼 끝나, 옛 프론트가 임베드된 채 남는다. 빌드 전 앱 종료 + 빌드 후 exe mtime/번들 해시 확인 필수.

## 배경 / 근본 원인
사이드바에서 세션 여러 개를 클릭하면 본문이 최대 4분할되는 "split view" 기능은 **`main` 브랜치에만**(구조: `expo-app/sources/`) 구현돼 있고, 빌드 대상인 **`migration/upstream-sync`**(구조: `packages/happy-app/sources/`)에는 없음. 두 브랜치는 디렉터리 구조와 `SidebarNavigator` 구현이 달라 cherry-pick 불가 → 수동 이식.

## 호환성(확인 완료)
- migration `SessionView` = `({ id }: { id: string })` → main `SplitPanel`의 `<SessionView id={...} />` 그대로 호환
- `@/components/StyledText`, `theme.colors.surface/divider/shadow`(라이트/다크), `Typography`, MMKV persistence 패턴 모두 존재
- migration엔 `ActiveSessionsGroup` 없음 → 클릭 배선은 `SessionsList`만

## 통합 지점(핵심 설계)
- migration `SidebarNavigator`는 **영구 Drawer**(drawerContent=`SidebarView`) + content 영역에 라우트 화면 렌더. index 라우트 화면 = `(app)/index.tsx` → `MainView variant="phone"` → 태블릿일 때 **빈 View 반환**(현재 본문이 비어 있는 이유, `MainView.tsx:293-296`).
- 따라서 그 **빈 View 자리에 `SplitViewContainer`를 렌더**하면 main의 "index 본문 오버레이"와 동일 효과. 세그먼트 체크 불필요(MainView는 index에서만 렌더).
- 클릭 시 `router.navigate('/')`로 index 유지 → SplitViewContainer가 패널들을 표시.

## 변경 목록

### 신규 파일 (main에서 거의 그대로 복사)
1. `sources/hooks/useSplitView.ts` — zustand 스토어(`panels`, `maxPanels:4`, `addPanel/setPanel/removePanel/closeAllPanels/hasPanel`), `useSplitViewPanels/Active/PanelCount`, `hydrateSplitViewPanels`, `isSplitViewSupported`(web 전용).
2. `sources/components/SplitViewContainer.tsx` — `panels.map(SplitPanel)` 가로 배치 + "Select a session" 빈 상태.
3. `sources/components/SplitPanel.tsx` — `<SessionView id />` 래핑 + 닫기 버튼 + 구분선.

### 편집
4. `sources/sync/persistence.ts` — `loadSplitViewPanels()/saveSplitViewPanels()` 추가(MMKV 키 `split-view-panels`, main과 동일).
5. `sources/components/SessionsList.tsx` — 클릭 배선:
   - `addPanel/hasPanel` 구독 추가
   - **태블릿+web**: `onPressIn` → `addPanel(session.id)` + `router.navigate('/')`
   - **그 외(폰/native)**: 기존 `navigateToSession(session.id)` 유지
   - (선택) `isInSplitView` 표시용 인디케이터
6. `sources/components/MainView.tsx` — `if (isTablet)` 분기(현재 빈 View)에서 `isSplitViewSupported()`면 `<SplitViewContainer />` 렌더(아니면 기존 빈 View).
7. `sources/components/SidebarNavigator.tsx` — 마운트 시 `hydrateSplitViewPanels()` 1회(useEffect). (영속화된 패널 복원)

## 게이팅 방침
- split view는 **web(=Tauri 데스크톱) + 태블릿 크기**에서만 활성. native/폰은 기존 단일 네비게이션 유지(회귀 방지).

## 검증
1. `pnpm typecheck` 통과 (CLAUDE.md 필수)
2. 재빌드(`tauri:build:production`) 후 실행
3. 동작 확인: 사이드바에서 세션 클릭 → 본문에 패널 추가, 여러 개 클릭 시 최대 4분할, 각 패널 닫기, 재시작 후 패널 복원
4. 원격 디버깅(CDP)으로 패널 컬럼 기하 측정(자동 검증 가능)

## 리스크 / 미해결
- main의 `SplitPanel` 닫기 버튼 위치/스타일이 migration의 `ChatHeaderView`와 겹칠 수 있음 → 빌드 후 육안/CDP 확인.
- 태블릿에서 알림/딥링크로 `/session/[id]` 직접 진입 시 단일 풀스크린(기존 동작). 범위 외.
