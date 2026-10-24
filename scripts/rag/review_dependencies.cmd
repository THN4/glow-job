@echo off
setlocal
pushd "%~dp0..\.."
if errorlevel 1 exit /b 1
docker compose run --rm --no-deps -it -e PYTHONDONTWRITEBYTECODE=1 -e PYTHONPATH=/workspace/data-pipeline ^
  -v "%CD%:/workspace:ro" ^
  -v "%CD%/data-pipeline/data/processed/skill_dependencies:/output" ^
  -w /workspace/data-pipeline backend ^
  python -m scripts.documents.skill_dependencies review --manifest /output/prepared-documents-v1.json --reviewer owner %*
set "dependency_review_exit=%ERRORLEVEL%"
popd
endlocal & exit /b %dependency_review_exit%
