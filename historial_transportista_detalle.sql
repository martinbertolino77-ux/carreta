CREATE OR REPLACE FUNCTION public.historial_transportista_detalle(
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS TABLE(
  pedido_id uuid, numero integer, fecha_publicacion date,
  productor text, tipo_carga text,
  origen_localidad text, origen_provincia text,
  destino_localidad text, destino_provincia text,
  dominio_chasis text, dominio_remolque text, chofer text,
  kilos_asignados numeric, kilos_descargados numeric,
  humedad numeric, cuerpos_extraños numeric, granos_dañados numeric,
  fecha_descarga date, observaciones_descarga text,
  precio_acordado text, forma_pago text, monto_final numeric,
  estado text, calif_recibida numeric, calif_dada numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH mi_t AS (
    SELECT t.id AS t_id
    FROM transportistas t
    WHERE t.usuario_id = auth.uid()
  )
  SELECT
    p.id,
    p.numero,
    p.created_at::date,
    coalesce(nullif(up.razon_social,''), trim(up.nombre || ' ' || coalesce(up.apellido,''))),
    CASE p.tipo_actividad::text
      WHEN 'agricola' THEN initcap(coalesce(p.tipo_cereal::text, 'Agricola'))
      WHEN 'ganadero' THEN 'Ganadero'
      ELSE coalesce(initcap(p.producto_granel), 'Otras cargas')
    END,
    e.localidad, e.provincia,
    p.destino_localidad, p.destino_provincia,
    ch.dominio,
    a.dominio,
    trim(cf.nombre || ' ' || coalesce(cf.apellido,'')),
    cv.kilos_asignados,
    cv.kilos_descargados,
    cv.humedad,
    cv."cuerpos_extraños",
    cv."granos_dañados",
    cv.fecha_descarga::date,
    cv.observaciones_descarga,
    o.precio_acordado,
    o.forma_pago,
    o.monto_final,
    p.estado::text,
    (SELECT round(avg((c.puntaje_1+c.puntaje_2+c.puntaje_3)::numeric/3),1)
      FROM calificaciones c WHERE c.oferta_id = o.id AND c.calificador_rol = 'productor'),
    (SELECT round(avg((c.puntaje_1+c.puntaje_2+c.puntaje_3)::numeric/3),1)
      FROM calificaciones c WHERE c.oferta_id = o.id AND c.calificador_rol = 'transportista')
  FROM ofertas o
  JOIN mi_t mt ON mt.t_id = o.transportista_id
  JOIN pedidos p ON p.id = o.pedido_id
  JOIN datos_operativos d ON d.pedido_id = p.id AND d.transportista_id = mt.t_id
  JOIN camiones_viaje cv ON cv.datos_operativos_id = d.id
  LEFT JOIN chasis ch ON ch.id = cv.chasis_id
  LEFT JOIN acoplados a ON a.id = cv.acoplado_id
  LEFT JOIN choferes cf ON cf.id = cv.chofer_id
  LEFT JOIN establecimientos e ON e.id = p.establecimiento_id
  LEFT JOIN productores pr ON pr.id = p.productor_id
  LEFT JOIN usuarios up ON up.id = pr.usuario_id
  WHERE o.estado IN ('seleccionada','cancelada')
    AND p.estado IN ('completado','cancelado')
    AND (p_desde IS NULL OR p.created_at::date >= p_desde)
    AND (p_hasta IS NULL OR p.created_at::date <= p_hasta)
  ORDER BY p.created_at DESC, cv.id
$function$;
