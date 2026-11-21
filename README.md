# Tubig

**Know what your water provider owes you.** A working prototype for DevEng 203 (UC Berkeley, Fall 2026) by Gregor Posadas.

Live site: https://gregor-posadas.github.io/tubig/

Tubig helps a household in the Philippines:

1. **See what it's owed.** Find a barangay, match it to its water provider, and see every service standard that applies, with the law or rule it comes from, or "no rule found."
2. **Describe its service.** Seven plain questions on hours, pressure, quality, outages, complaints, billing and connections.
3. **See the gap.** Each answer is checked against the rule: met, not met, needs checking, or no rule exists.
4. **Act on it.** A complaint letter that cites the rule, a phone script, and the offices to contact, in order.

It also has an explorer for all 554 water districts with their public record (LWUA, COA, news-reported complaints).

## Privacy

Everything runs in the browser. There are no accounts and nothing a user types is sent to a server run by this project. Progress is saved only in the browser's local storage. Place names (or, with "Use my location", coordinates) are sent to OpenStreetMap Nominatim to place them on the map.

## Data

`data/` holds preliminary extracts from the author's research datasets: a service-obligations inventory, a water-district crosswalk (LWUA, NWRB, COA), news-reported complaints, and the Mabalacat City Water District audit record, plus the PSA PSGC (3Q 2026). They are under human verification. Not legal advice.
