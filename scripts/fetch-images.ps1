$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
$dir = "public/products"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# id -> pagina do produto (apenas itens com pagina dedicada real)
$items = @(
  @{ id = "069510-p17073"; url = "https://www.fenomenal.com.br/blusa-medieval-fenomenal-069510-p17073" },
  @{ id = "014579-p18638"; url = "https://www.fenomenal.com.br/blusa-lisa-brasil-fenomenal-014579-p18638" },
  @{ id = "300153";        url = "https://www.fenomenal.com.br/blusa-famosa-mullet-fenomenal-p300153" },
  @{ id = "039220-p54806"; url = "https://www.fenomenal.com.br/blusa-long-line-fenomenal-039220-p54806" },
  @{ id = "019911-p16639"; url = "https://www.fenomenal.com.br/blusa-feminina-malha-fria-moderna-fenomenalrnsem-elasticidade-019911-p16639" },
  @{ id = "015981-p16358"; url = "https://www.fenomenal.com.br/blusa-feminina-gola-v-menor-fenomenal-015981-p16358" },
  @{ id = "010948-p38492"; url = "https://www.fenomenal.com.br/kit-6-blusas-gola-de-outra-cor-fenomenal-010948-p38492" },
  @{ id = "196211-p525677"; url = "https://www.fenomenal.com.br/baby-look-brasil-mais-fenomenal-196211-p525677" },
  @{ id = "017091-p44445"; url = "https://www.fenomenal.com.br/conjunto-moletom-flanelado-plus-size-jaqueta-e-calca-punho-feminino-017091-p44445" },
  @{ id = "011049-p44297"; url = "https://www.fenomenal.com.br/conjunto-moletom-flanelado-blusao-basico-e-calca-punho-feminino-011049-p44297" },
  @{ id = "012072-p44353"; url = "https://www.fenomenal.com.br/conjunto-moletom-flanelado-jaqueta-e-calca-punho-feminino-012072-p44353" },
  @{ id = "011050-p44310"; url = "https://www.fenomenal.com.br/conjunto-moletom-flanelado-blusao-basico-e-calca-punho-masculino-011050-p44310" },
  @{ id = "012071-p44340"; url = "https://www.fenomenal.com.br/conjunto-moletom-flanelado-blusao-jovem-e-calca-punho-masculino-012071-p44340" },
  @{ id = "018100-p44406"; url = "https://www.fenomenal.com.br/conjunto-moletom-flanelado-plus-size-blusao-basico-e-calca-punho-masculino-018100-p44406" }
)

$results = @()
foreach ($it in $items) {
  try {
    $r = Invoke-WebRequest -Uri $it.url -UserAgent $ua -UseBasicParsing -TimeoutSec 30
    $m = [regex]::Match($r.Content, 'property="og:image"[^>]*content="([^"]+)"')
    if (-not $m.Success) {
      $results += "SEM_OGIMAGE: $($it.id)"
      continue
    }
    $imgUrl = $m.Groups[1].Value
    # A og:image e a miniatura (_tN_). Trocamos para a versao zoom (_zN_) = alta resolucao.
    $zoomUrl = [regex]::Replace($imgUrl, '_t(\d+)_', '_z$1_')
    $ext = [System.IO.Path]::GetExtension(($imgUrl -split '\?')[0])
    if (-not $ext) { $ext = ".webp" }
    $outFile = Join-Path $dir ($it.id + $ext)

    $downloaded = $false
    try {
      Invoke-WebRequest -Uri $zoomUrl -UserAgent $ua -UseBasicParsing -TimeoutSec 30 -OutFile $outFile
      $downloaded = $true
    } catch {
      # fallback para a versao media (_mN_)
      $medUrl = [regex]::Replace($imgUrl, '_t(\d+)_', '_m$1_')
      try {
        Invoke-WebRequest -Uri $medUrl -UserAgent $ua -UseBasicParsing -TimeoutSec 30 -OutFile $outFile
        $downloaded = $true
      } catch {
        Invoke-WebRequest -Uri $imgUrl -UserAgent $ua -UseBasicParsing -TimeoutSec 30 -OutFile $outFile
        $downloaded = $true
      }
    }
    $sz = (Get-Item $outFile).Length
    $results += ("OK: " + $it.id + $ext + " (" + $sz + "b)")
  }
  catch {
    $results += ("ERRO: " + $it.id + " -> " + $_.Exception.Message)
  }
  Start-Sleep -Milliseconds 800
}

Write-Output "==== RESULTADO ===="
$results | ForEach-Object { Write-Output $_ }
