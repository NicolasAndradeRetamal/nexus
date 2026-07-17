# Starcraft-themed status line for Claude Code
# Receives session JSON on stdin, prints a 2-line HUD.
# ASCII-only source: glyphs are built from code points so encoding never breaks.

$raw = $input | Out-String
try { $d = $raw | ConvertFrom-Json } catch { Write-Output "[HUD OFFLINE]"; exit 0 }

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# --- ANSI palette (Protoss gold / cyan) ---
$e = [char]27
$R     = "$e[0m"
$gold  = "$e[38;5;214m"
$cyan  = "$e[38;5;45m"
$green = "$e[38;5;40m"
$yell  = "$e[38;5;220m"
$red   = "$e[38;5;196m"
$blue  = "$e[38;5;75m"
$gray  = "$e[38;5;244m"
$mag   = "$e[38;5;171m"

# --- Glyphs ---
$gBarF   = [char]0x25B0                            # filled bar
$gBarE   = [char]0x25B1                            # empty bar
$gWarn   = [char]0x26A0                            # warning
$gBolt   = [char]0x26A1                            # supply
$gMin    = [char]::ConvertFromUtf32(0x1F48E)       # minerals (gem)
$gGas    = [char]0x26FD                            # vespene gas
$gClk    = [char]0x23F1                            # game clock
$gSword  = [char]0x2694                            # kills (lines +/-)
$gTarget = [char]0x2316                            # active agent
$gStar   = [char]0x2726                            # thinking enabled
$gPlanet = [char]::ConvertFromUtf32(0x1FA90)       # sector (dir)
$gBranch = [char]::ConvertFromUtf32(0x1F33F)       # git branch

# --- Unit (model) ---
$modelId = ""
$modelName = "?"
if ($d.model) {
    if ($d.model.id) { $modelId = [string]$d.model.id }
    if ($d.model.display_name) { $modelName = [string]$d.model.display_name }
}
$unit = "Dragoon"
if ($modelId -like "*fable*" -or $modelId -like "*mythos*") { $unit = "Archon" }
elseif ($modelId -like "*opus*")   { $unit = "High Templar" }
elseif ($modelId -like "*sonnet*") { $unit = "Zealot" }
elseif ($modelId -like "*haiku*")  { $unit = "Probe" }

$think = ""
if ($d.thinking -and $d.thinking.enabled) { $think = " $mag$gStar$R" }

# --- Supply (context window) ---
$pct = 0; $usedK = 0; $capK = 200
if ($d.context_window) {
    $cw = $d.context_window
    if ($cw.used_percentage) { $pct = [int][math]::Floor([double]$cw.used_percentage) }
    if ($cw.total_input_tokens) { $usedK = [int][math]::Round([double]$cw.total_input_tokens / 1000) }
    if ($cw.context_window_size) { $capK = [int][math]::Round([double]$cw.context_window_size / 1000) }
}
if ($pct -gt 100) { $pct = 100 }
$supColor = $green
if ($pct -ge 90) { $supColor = $red } elseif ($pct -ge 70) { $supColor = $yell }
$filled = [int][math]::Floor($pct / 10)
$bar = ([string]$gBarF * $filled) + ([string]$gBarE * (10 - $filled))

# --- Minerals (session cost) + game clock + kills ---
$cost = 0.0; $durMs = 0; $lAdd = 0; $lDel = 0
if ($d.cost) {
    if ($d.cost.total_cost_usd) { $cost = [double]$d.cost.total_cost_usd }
    if ($d.cost.total_duration_ms) { $durMs = [long]$d.cost.total_duration_ms }
    if ($d.cost.total_lines_added) { $lAdd = [int]$d.cost.total_lines_added }
    if ($d.cost.total_lines_removed) { $lDel = [int]$d.cost.total_lines_removed }
}
$costFmt = $cost.ToString("0.00", [System.Globalization.CultureInfo]::InvariantCulture)
$mins = [int][math]::Floor($durMs / 60000)
$hours = [int][math]::Floor($mins / 60)
if ($hours -gt 0) { $clock = "{0}h{1:00}m" -f $hours, ($mins % 60) } else { $clock = "{0}m" -f $mins }

# --- Vespene gas (rate limits) ---
$gasTxt = ""
$gasWorst = 0
if ($d.rate_limits) {
    $parts = @()
    foreach ($w in @(@("five_hour", "5h"), @("seven_day", "7d"))) {
        $win = $d.rate_limits.($w[0])
        if ($win -and $win.PSObject.Properties['used_percentage'] -and $null -ne $win.used_percentage) {
            $g = [int][math]::Round([double]$win.used_percentage)
            if ($g -gt $gasWorst) { $gasWorst = $g }
            $parts += ("{0}:{1}%" -f $w[1], $g)
        }
    }
    if ($parts.Count -gt 0) {
        $gasColor = $green
        if ($gasWorst -ge 90) { $gasColor = $red } elseif ($gasWorst -ge 70) { $gasColor = $yell }
        $gasTxt = "  $gGas $gasColor$($parts -join ' ')$R"
    }
}

# --- Sector (dir) + git branch ---
$dirName = ""
$cwd = ""
if ($d.workspace -and $d.workspace.current_dir) { $cwd = [string]$d.workspace.current_dir }
if ($cwd) { $dirName = Split-Path $cwd -Leaf }
$branchTxt = ""
if ($cwd) {
    try {
        $branch = git -C $cwd branch --show-current 2>$null | Select-Object -First 1
        if ($branch) { $branchTxt = "  $gray$gBranch$R $green$branch$R" }
    } catch {}
}

# --- Active agent (claude --agent) ---
$agentTxt = ""
if ($d.agent -and $d.agent.name) { $agentTxt = "  $mag$gTarget $($d.agent.name)$R" }

# --- Alerts (Starcraft voice lines) ---
$alert = ""
if ($pct -ge 90) { $alert = "  $red$gWarn YOU MUST CONSTRUCT ADDITIONAL PYLONS$R" }
elseif ($gasWorst -ge 90) { $alert = "  $red$gWarn NOT ENOUGH VESPENE GAS$R" }
elseif ($pct -ge 70) { $alert = "  $yell$gWarn SUPPLY RUNNING LOW$R" }

# --- Render ---
$line1 = "$gold$gBolt $unit$R $gray[$modelName]$R$think"
if ($dirName) { $line1 += "  $cyan$gPlanet $dirName$R" }
$line1 += $branchTxt + $agentTxt

$kills = ""
if (($lAdd + $lDel) -gt 0) { $kills = "  $gSword $green+$lAdd$R/$red-$lDel$R" }

$line2 = "$supColor$bar$R $supColor$usedK" + "k/$capK" + "k$R $gray($pct%)$R  $blue$gMin `$$costFmt$R$gasTxt  $gray$gClk $clock$R$kills$alert"

Write-Output $line1
Write-Output $line2
