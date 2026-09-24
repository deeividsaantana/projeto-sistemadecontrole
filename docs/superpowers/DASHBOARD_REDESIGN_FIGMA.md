# Dashboard Redesign — Figma Specification

**Date:** 2026-09-24  
**Status:** PENDING IMPLEMENTATION  
**Priority:** HIGH — Gate for Materiais aba unlock

---

## Sidebar Design (FINAL)

### Core Behavior
- ✅ **Click-to-expand** (NOT hover-based)
- ✅ Expands ONLY when clicking navigation icons
- ✅ Starts collapsed showing only icons
- ✅ Shows page labels when expanded
- ✅ Close button (X) when expanded to collapse

### Visual Design
- ✅ **Margins**: ml-6 my-6 (left margin + top/bottom spacing)
- ✅ **Curved edges**: rounded-3xl for elegant appearance
- ✅ **Shadows**: Enhanced shadow effects for depth
- ✅ **Gradients**: Maintained EMS green gradient theme
- ✅ **Active indicators**: Side stripe when collapsed, adapt when expanded

### Animations
- ✅ **Transition speed**: 300ms smooth cubic-bezier easing
- ✅ **Expansion**: Sidebar expands 80px → 256px on click
- ✅ **Icons**: Maintain circular shape when collapsed, resize to rectangular when expanded
- ✅ **Hover effects**: Scaling and shadow enhancements

### User Experience
- ✅ Tooltips on hover for collapsed icons (showing page names)
- ✅ Profile avatar can toggle sidebar expansion
- ✅ Profile information expands to show full name/role when sidebar expands
- ✅ Header/branding only shows when expanded
- ✅ Pulsing indicators for active page feedback

---

## Dashboard Layout (Figma Reference)

**Link:** https://www.figma.com/make/WUG4CTyIV0VMASa8KDZCQG/Energy-Management-System-Dashboard--Community-?t=GiU6bCyPpeVDZabt-1

### Expected Structure
- **Sidebar**: Left side, click-to-expand, ~80px collapsed / ~256px expanded
- **Main content**: Right side, full height
- **3 Levels** (need visual confirmation from Figma):
  - Level 1: KPIs (top section)
  - Level 2: Operational table (middle)
  - Level 3: Insights/graphs (bottom)

### Color Scheme (Current, verify in Figma)
- **Primary Green**: #176b4d (sidebar, active states)
- **Accent Orange**: #f26a2e (highlights, focus)
- **Background**: #f7f8f6 (light)
- **Borders**: #dce3df
- **Gradients**: Green gradients maintained throughout

### Typography (verify in Figma)
- Title: 28px, font-black
- Body: 14px, font-normal
- Labels: 12px, font-semibold
- KPI values: 32px, font-black, tabular-nums

---

## Implementation Tasks (Next Session)

### Task A: Sidebar Redesign
- [ ] Remove/update current sidebar
- [ ] Implement click-to-expand logic
- [ ] Add margins (ml-6, my-6)
- [ ] Implement rounded-3xl edges
- [ ] Add close button (X)
- [ ] Implement 300ms transitions
- [ ] Add hover tooltips
- [ ] Profile section expansion

### Task B: Dashboard Layout Validation
- [ ] Verify exact layout in Figma
- [ ] Update Dashboard component structure if needed
- [ ] Adjust spacing/margins to match Figma
- [ ] Color validation against Figma palette
- [ ] Typography verification

### Task C: Final Polish
- [ ] Lighthouse validation > 90
- [ ] Performance profiling
- [ ] E2E tests for new sidebar
- [ ] Deploy to Render

---

## Notes

- Current Dashboard is 100% functional (4/4 tests pass)
- Sidebar is the main visual change needed
- Dashboard 3 levels stay the same (KPIs, Operational, Insights)
- Performance is acceptable (67/100 Lighthouse)
- Ready for production deployment once sidebar is updated

---

## Next Session Action

1. Open Figma link in browser (visual reference)
2. Implement Task A (Sidebar redesign)
3. Validate Task B (Dashboard layout)
4. Execute Task C (Polish + deploy)
5. Unlock Materiais aba for next phase

**Estimated time:** 3-4 hours for full implementation + validation

