// Derive an album chart without mutating the imported tracks.
function buildAlbumChart(tracks) {
  const albums = new Map();
  const unresolved = [];
  for (const [index, track] of tracks.entries()) {
    const album = track.album;
    if (!track.matched || !album?.id || !album.name) {
      unresolved.push(track);
      continue;
    }
    const key = String(album.id);
    if (!albums.has(key)) {
      albums.set(key, {id: album.id, position: index, matched: true, name: album.name,
        album: {...album}, artists: [], tracks: [], artistSource: 'tracks'});
    }
    const item = albums.get(key);
    item.tracks.push(track);
    if (!item.album.cover && album.cover) item.album.cover = album.cover;
    // Prefer album-level credits when the source provides them. Otherwise the UI
    // explicitly describes these as the artists of the imported tracks.
    const officialArtists = album.artists?.filter(artist => artist.name) || [];
    if (officialArtists.length && item.artistSource !== 'album') {
      item.artists = []; item.artistSource = 'album';
    }
    const candidates = officialArtists.length ? officialArtists : item.artistSource === 'tracks' ? track.artists || [] : [];
    for (const artist of candidates) {
      if (!item.artists.some(existing => artist.id ? String(existing.id) === String(artist.id) : existing.name === artist.name)) {
        item.artists.push({...artist});
      }
    }
  }
  return {items: [...albums.values()], unresolved};
}
