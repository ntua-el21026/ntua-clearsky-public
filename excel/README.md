# Synthetic grade-upload workbooks

The [basic file](demo-basic.xlsx) has the seven import columns and three
fictional records. The [detailed file](demo-detailed.xlsx) adds `Q01`
through `Q10` with numeric scores on the 0–10 scale and three fictional
records. Both use one visible worksheet, two introductory rows, Greek
headers on row three, course codes and exam periods. The example email
addresses use `example.invalid`.

## Historical course inputs

Three original basic workbooks demonstrated the common export structure.
Two detailed workbooks demonstrated per-question scores; the annotated
version also illustrated instructor instructions. They were useful as
examples for the upload and preview contract. The repository includes two
independently generated workbooks with the same field roles and fictional
data. The historical documents and their original records remain external.
An authorized user can seek the exact versions through the
[NTUA course site](https://helios.ntua.gr/course/view.php?id=1015).

## Demonstration and validation

Use either workbook in the instructor grade-upload preview. The offline
check on 18 November 2026 used the locked SheetJS 0.17.5 bundle, stubbed
upload deletion, and disabled service access. Each file parsed with the
expected first-sheet layout. The preview controller returned the expected
fictional course, exam period, and three grade entries. Live database
submission requires a separate integration check. Reproducing the original
workbook contents requires authorized access to the specific course editions.
[Grade service guide](../grades_management_microservice/README.md)
