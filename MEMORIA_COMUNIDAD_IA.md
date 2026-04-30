# 📋 MEMORIA: Funciones eliminadas — Comunidad IA

> **Fecha de eliminación**: 28 abril 2026  
> **Commit donde se agregó**: `54605718f29d84e04eb2d635d7cb1f5a19b4c0bd` (20 abril 2026)  
> **Commit previo (restaurado)**: `06a505bad791cac260ce715f04259714c82ec95c`  
> **Commits que modificaron Comunidad**: `5460571`, `699a7e3`, `ddc7bb7`, `d812a52`  

---

## 🗂 Archivos eliminados

### 1. `src/app/api/comunidad/route.ts` (67 líneas)
**API REST para la galería comunitaria** — Conecta con la tabla `community_gallery` en Supabase.

#### Función `GET /api/comunidad`
- **Propósito**: Obtiene las publicaciones de la galería comunitaria.
- **Autenticación**: Requiere usuario autenticado con Clerk (`currentUser()`).
- **Parámetros**: `?limit=N` (default: 30) — Limita la cantidad de resultados.
- **Query Supabase**: `community_gallery` → `select("*")` → `order("created_at", { ascending: false })` → `.limit(limit)`.
- **Respuesta exitosa**: `{ success: true, data: [...] }`
- **Errores**: Devuelve código 401 (no autorizado) o 500 (error Supabase/general).

#### Función `POST /api/comunidad`
- **Propósito**: Publica una nueva imagen en la galería comunitaria.
- **Autenticación**: Requiere usuario autenticado con Clerk.
- **Body JSON requerido**:
  - `image_url` (string, **obligatorio**) — URL de la imagen generada.
  - `prompt_used` (string, **obligatorio**) — El prompt que se usó para generar la imagen.
  - `model_used` (string, opcional) — Modelo de IA usado (default: "Nano IA").
  - `reference_urls` (string[], opcional) — URLs de imágenes de referencia usadas.
- **Campos insertados en Supabase**:
  - `author_id`: ID del usuario Clerk.
  - `author_name`: Nombre del usuario (firstName → username → "Artista").
  - `author_avatar`: URL del avatar del usuario.
  - `image_url`, `prompt_used`, `model_used`, `reference_urls`.
  - `likes_count`: Inicializado en 0.
- **Respuesta exitosa**: `{ success: true, message: "¡Publicado en la comunidad!" }`

---

### 2. `src/app/dashboard/comunidad/page.tsx` (462 líneas)
**Página del dashboard "Comunidad IA"** — Galería social donde los usuarios VIP ven y comparten obras de IA.

#### Componente principal: `ComunidadPage`
- **Acceso**: Solo usuarios VIP (protegido con `<VipGate>`).
- **Ruta**: `/dashboard/comunidad`

##### Estados:
| Estado | Tipo | Propósito |
|--------|------|-----------|
| `items` | `GalleryItem[]` | Lista de publicaciones de la galería |
| `loading` | `boolean` | Indicador de carga inicial |
| `copiedId` | `string \| null` | ID del item cuyo prompt fue copiado |
| `likedIds` | `Set<string>` | IDs de items que el usuario marcó con "like" (solo local) |
| `lightbox` | `GalleryItem \| null` | Item seleccionado para vista ampliada |
| `searchQuery` | `string` | Filtro de búsqueda por prompt o autor |
| `showScrollTop` | `boolean` | Mostrar botón de scroll al tope |

##### Funciones:

| Función | Descripción |
|---------|-------------|
| `fetchGallery()` | Llama `GET /api/comunidad?limit=60` y carga los items en el estado |
| `copyPrompt(item)` | Copia el prompt del item al portapapeles del usuario |
| `handleRecreate(item)` | Navega a `/dashboard/estudio?prompt=<prompt_encoded>` para recrear la imagen |
| `toggleLike(id)` | Agrega/quita un "like" local (no se persiste en DB, era visual) |
| `timeAgo(dateStr)` | Formatea fechas relativas: "ahora", "5m", "2h", "3d", "1sem" |
| `getColumns(count)` | Distribuye items en N columnas para layout Masonry |

##### UI Features:
- **Sticky header** con título "Comunidad IA" + contador de obras + barra de búsqueda.
- **Grid Masonry responsivo**: 2 columnas (mobile), 3 columnas (tablet), 4 columnas (desktop).
- **Lightbox modal**: Vista ampliada de la imagen con panel lateral de info (autor, prompt, modelo, refs).
- **Acciones en hover**: Botón "Recrear" (navega al estudio), "Copiar prompt", "Like".
- **Scroll to top**: Botón flotante cuando scrollY > 600px.
- **Filtro de búsqueda**: Filtra por `prompt_used` o `author_name`.

#### Componente: `MasonryGrid`
- **Props**: `columns`, `onCopy`, `onRecreate`, `onLike`, `onLightbox`, `copiedId`, `likedIds`, `timeAgo`
- **Propósito**: Renderiza el grid de columnas con las tarjetas.

#### Componente: `MasonryCard`
- **Props**: `item`, `index`, `onCopy`, `onRecreate`, `onLike`, `onLightbox`, `copiedId`, `isLiked`, `timeAgo`
- **Propósito**: Tarjeta individual con lazy loading de imagen, overlay con acciones en hover, footer con avatar del autor.
- **Animación**: Delay escalonado basado en `index * 50ms`.

#### Interface: `GalleryItem`
```typescript
interface GalleryItem {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  image_url: string;
  prompt_used: string;
  model_used: string;
  reference_urls: string[] | null;
  likes_count: number;
  created_at: string;
}
```

---

## 🔧 Archivos modificados (cambios revertidos)

### 3. `src/components/SidebarNav.tsx`
**Cambio**: Se agregó el item de navegación "Comunidad IA" en el menú lateral.

```typescript
// LÍNEA ELIMINADA (era línea 51):
{ name: "Comunidad IA", href: "/dashboard/comunidad", exact: false, icon: LayoutGrid, adminOnly: false, vipOnly: true, requiresBot: false },
```

- **Import eliminado**: `LayoutGrid` de lucide-react (si solo se usaba aquí).
- **Ubicación en el menú**: Entre "Partidos EN VIVO" y "Social Media".
- **Acceso**: Solo VIP (`vipOnly: true`).

---

### 4. `src/app/dashboard/estudio/page.tsx`
**Cambios eliminados**:

#### Función `publishToCommunity(img)` (líneas 406-427)
```typescript
const publishToCommunity = async (img: any) => {
  // Hace POST a /api/comunidad con:
  //   image_url, prompt_used, model_used, reference_urls
  // Muestra alert de éxito o error
};
```
- **Propósito**: Publica una imagen generada en la galería comunitaria desde el Estudio IA.
- **Endpoint**: `POST /api/comunidad`
- **Feedback al usuario**: Alert nativo con "¡Publicado en la comunidad con éxito! +5 Créditos 🎁 (En desarrollo)".

#### Botón "Hacer Público" en el JSX (líneas 892-897)
```jsx
<button onClick={() => publishToCommunity(img)} 
  className="...bg-gradient-to-r from-blue-500/10 to-indigo-500/10...">
  <Globe /> Hacer Público
</button>
```
- **Ubicación**: En cada tarjeta de imagen del historial, arriba del botón "Editor PRO".
- **Icono**: `Globe` de lucide-react.

#### Pre-fill de prompt desde query params (líneas 102-117)
```typescript
// Pre-fill prompt from query params (from Community "Recrear" button)
const searchParams = useSearchParams();
useEffect(() => {
  const prePrompt = searchParams.get("prompt");
  if (prePrompt) {
    setPrompt(prePrompt);
    // Auto-resize textarea + focus
  }
}, [searchParams]);
```
- **Propósito**: Cuando un usuario clickea "Recrear" en la Comunidad, navega al Estudio con el prompt ya cargado.

---

## 🗄 Tabla de Supabase asociada

### `community_gallery`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | Primary key |
| `author_id` | string | Clerk user ID |
| `author_name` | string | Nombre del autor |
| `author_avatar` | string | URL del avatar |
| `image_url` | string | URL de la imagen publicada |
| `prompt_used` | string | Prompt usado para generar |
| `model_used` | string | Modelo de IA (ej: "Nano IA") |
| `reference_urls` | string[] / null | URLs de imágenes de referencia |
| `likes_count` | integer | Contador de likes (default: 0) |
| `created_at` | timestamp | Fecha de creación |

> ⚠️ **Nota**: La tabla en Supabase NO se elimina con este rollback. Solo se eliminan los archivos de código.

---

## 📌 Dependencias usadas (no eliminar, las usan otros módulos)
- `@clerk/nextjs` (currentUser, useUser)
- `@supabase/supabase-js` (supabase client)
- `lucide-react` (LayoutGrid, Globe, Clipboard, Check, Sparkles, Heart, Search, X, ArrowUp, Loader2)
- `next/navigation` (useRouter, useSearchParams)
- `@/components/VipGate`
- `@/lib/supabase`
