$app = Get-Content app.js -Encoding UTF8
$engine = Get-Content engine.js -Encoding UTF8
$top = $app[0..44]
$bottom = $app[1094..($app.Length - 1)]

# Now we need to make those minor changes to checkAuthState, history, etc.
# We can do simple Regex replace on $bottom block because it's clean text.

$bottomStr = $bottom -join "`n"

$bottomStr = $bottomStr -replace "const currentView = document.querySelector\('\[id\^=`"view-`"\]:not\(\.hidden\)'\);", "await loadAvailableGames();`n                const currentView = document.querySelector('[id^=`"view-`"]:not(.hidden)');"

# For registerBetFromGenerator, we know it's defined near line 1945, so it's in the bottom block
# We replace the body. But Regex replace across lines is tricky.
# I'll just leave it and use multi_replace_file_content for registerBet!

# Same for loadFromHistory/saveToHistory, I will use multi_replace_file_content!

$final = $top + $engine + ($bottomStr -split "`n")

Set-Content -Path "app_new.js" -Value $final -Encoding UTF8
