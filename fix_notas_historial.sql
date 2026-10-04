-- RPC resumen por transportista: nota de negociacion desde ofertas.nota_productor
CREATE OR REPLACE FUNCTION public.historial_productor_transportista(
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS TABLE(
  pedido_id uuid, numero integer, fecha_publicacion date,
  tipo_carga text, establecimiento text,
  origen_localidad text, origen_provincia text,
  destino_localidad text, destino_provincia text,
  transportista text,
  camiones_aceptados integer,
  kilos_totales numeric,
  precio_acordado text, forma_pago text, monto_final numeric,
  estado text, fecha_descarga date,
  calif_recibida numeric, calif_dada numeric,
  nota_negociacion text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH mi_prod AS (
    SELECT pr.id AS prod_id, u.id AS user_id
    FROM productores pr
    JOIN usuarios u ON u.id = pr.usuario_id
    WHERE u.id = auth.uid()
  )
  SELECT
    p.id,
    p.numero,
    p.created_at::date,
    CASE p.tipo_actividad::text
      WHEN 'agricola' THEN initcap(coalesce(p.tipo_cereal::text, 'Agricola'))
      WHEN 'ganadero' THEN 'Ganadero'
      ELSE coalesce(initcap(p.producto_granel), 'Otras cargas')
    END,
    e.nombre,
    e.localidad, e.provincia,
    p.destino_localidad, p.destino_provincia,
    coalesce(nullif(ut.razon_social,''), trim(ut.nombre || ' ' || coalesce(ut.apellido,''))),
    o.camiones_aceptados,
    (SELECT sum(cv.kilos_asignados) FROM camiones_viaje cv
     JOIN datos_operativos d ON d.id = cv.datos_operativos_id
     WHERE d.pedido_id = p.id AND d.transportista_id = t.id),
    o.precio_acordado,
    o.forma_pago,
    o.monto_final,
    p.estado::text,
    (SELECT max(cv.fecha_descarga)::date FROM camiones_viaje cv
     JOIN datos_operativos d ON d.id = cv.datos_operativos_id
     WHERE d.pedido_id = p.id AND d.transportista_id = t.id),
    (SELECT round(avg((c.puntaje_1+c.puntaje_2+c.puntaje_3)::numeric/3),1)
     FROM calificaciones c WHERE c.oferta_id = o.id AND c.calificador_rol = 'transportista'),
    (SELECT round(avg((c.puntaje_1+c.puntaje_2+c.puntaje_3)::numeric/3),1)
     FROM calificaciones c WHERE c.oferta_id = o.id AND c.calificador_rol = 'productor'),
    o.nota_productor
  FROM pedidos p
  JOIN mi_prod mp ON mp.prod_id = p.productor_id
  JOIN ofertas o ON o.pedido_id = p.id AND o.estado = 'seleccionada'
  JOIN transportistas t ON t.id = o.transportista_id
  JOIN usuarios ut ON ut.id = t.usuario_id
  LEFT JOIN establecimientos e ON e.id = p.establecimiento_id
  WHERE p.estado IN ('completado','cancelado')
    AND (p_desde IS NULL OR p.created_at::date >= p_desde)
    AND (p_hasta IS NULL OR p.created_at::date <= p_hasta)
  ORDER BY p.created_at DESC, ut.razon_social
$function$;
