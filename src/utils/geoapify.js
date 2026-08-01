// Shared Geoapify city autocomplete.
//
// Returns STRUCTURED options: { label, city, country, countryCode } so one
// selection can fill city + country + phone dial code without splitting the
// display string. `&lang=en` is essential — without it the Arabic funnel
// returns country names in Arabic that match neither the country->region nor
// the country->dial map, silently blanking both.
//
// Used by the registration wizard, the profile page, and the profile-completion
// modal so they all behave identically (client, 25 Jul).
export async function fetchCityOptions(text) {
  try {
    const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&type=city&lang=en&apiKey=${apiKey}`,
    );
    const data = await res.json();
    if (!data.features) return [];
    const seen = new Set();
    const out = [];
    for (const f of data.features) {
      const p = f.properties || {};
      const label = p.formatted;
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push({
        label,
        city: p.city || p.county || p.address_line1 || '',
        country: p.country || '',
        countryCode: p.country_code || '',
      });
    }
    return out;
  } catch (error) {
    console.error('Geoapify error:', error);
    return [];
  }
}
