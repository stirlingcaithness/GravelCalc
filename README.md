# GravelCalc

GravelCalc is an offline Electron desktop app for calculating gravel quantities and road coverage. It now includes a **Bulk Calculator** tab that processes many Excel rows at once.

## Run the app

```bash
npm install
npm start
```

## Build a Windows installer

```bash
npm install
npm run dist:win
```

The installer appears in `dist/`.

## Bulk Calculator tab

Use **Bulk Calculator** to upload an Excel spreadsheet with one calculation per row. The first row must contain these headers:

```text
Mode, Length, LengthUnit, Width, WidthUnit, Thickness, ThicknessUnit, Density, DensityUnit, Waste%, GravelAmount, GravelUnit, ResultUnit, DistanceUnit
```

### Modes

- `A` means **How much gravel do I need?** Use Length, Width, Thickness, Density, Waste%, ResultUnit.
- `B` means **How far will my gravel go?** Use GravelAmount, GravelUnit, Width, Thickness, Density, Waste%, DistanceUnit.

### Units

- LengthUnit / WidthUnit / DistanceUnit: `m` or `km`
- ThicknessUnit: `mm`, `cm`, or `m`
- DensityUnit: `kgm3` or `tm3`
- GravelUnit / ResultUnit: `t` or `kg`

The app can download a ready-made template from the Bulk Calculator tab.

## Bulk actions

- Upload `.xlsx` or `.xls` files.
- Bad rows are flagged, good rows still process.
- Export results to Excel or CSV.
- Optionally add all valid bulk results to the History tab.

## Tests

```bash
npm test
```
