CREATE OR REPLACE FUNCTION public.historial_productor_detalle(
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL
)
RETURNS TABLE(
  pedido_id uuid, numero integer, fecha_publicacion date,
  tipo_carga text, establecimiento text,
  origen_localidad text, origen_provincia text,
  destino_localidad text, destino_provincia text,
  camiones_necesarios integer,
  transportista text, chofer text,
  dominio_chasis text, dominio_remolque text,
  kilos_asignados numeric,
  precio_acordado text, forma_pago text, monto_final numeric,
  estado text, fecha_carga date, fecha_descarga date,
  calif_recibida numeric, calif_dada numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH mi_prod AS (
    SELECT pr.id AS prod_id
    FROM productores pr
    WHERE pr.usuario_id = auth.uid()
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
    p.camiones_necesarios,
    coalesce(nullif(ut.razon_social,''), trim(ut.nombre || ' ' || coalesce(ut.apellido,''))),
    (SELECT trim(cf.nombre || ' ' || coalesce(cf.apellido,''))
     FROM camiones_viaje cv
     JOIN datos_operativos d ON d.id = cv.datos_operativos_id
     JOIN choferes cf ON cf.id = cv.chofer_id
     WHERE d.pedido_id = p.id AND d.transportista_id = t.id LIMIT 1),
    (SELECT ch.dominio FROM camiones_viaje cv
     JOIN datos_operativos d ON d.id = cv.datos_operativos_id
     JOIN chasis ch ON ch.id = cv.chasis_id
     WHERE d.pedido_id = p.id AND d.transportista_id = t.id LIMIT 1),
    (SELECT a.dominio FROM camiones_viaje cv
     JOIN datos_operativos d ON d.id = cv.datos_operativos_id
     LEFT JOIN acoplados a ON a.id = cv.acoplado_id
     WHERE d.pedido_id = p.id AND d.transportista_id = t.id LIMIT 1),
    (SELECT sum(cv.kilos_asignados) FROM camiones_viaje cv
     JOIN datos_operativos d ON d.id = cv.datos_operativos_id
     WHERE d.pedido_id = p.id AND d.transportista_id = t.id),
    o.precio_acordado,
    o.forma_pago,
    o.monto_final,
    p.estado::text,
    (SELECT d.fecha_carga FROM datos_operativos d
     WHERE d.pedido_id = p.id AND d.transportista_id = t.id LIMIT 1),
    (SELECT max(cv.fecha_descarga)::date FROM camiones_viaje cv
     JOIN datos_operativos d ON d.id = cv.datos_operativos_id
     WHERE d.pedido_id = p.id AND d.transportista_id = t.id),
    (SELECT round(avg((c.puntaje_1+c.puntaje_2+c.puntaje_3)::numeric/3),1)
     FROM calificaciones c WHERE c.oferta_id = o.id AND c.calificador_rol = 'transportista'),
    (SELECT round(avg((c.puntaje_1+c.puntaje_2+c.puntaje_3)::numeric/3),1)
     FROM calificaciones c WHERE c.oferta_id = o.id AND c.calificador_rol = 'productor')
  FROM pedidos p
  JOIN mi_prod mp ON mp.prod_id = p.productor_id
  JOIN ofertas o ON o.pedido_id = p.id AND o.estado = 'seleccionada'
  JOIN transportistas t ON t.id = o.transportista_id
  JOIN usuarios ut ON ut.id = t.usuario_id
  LEFT JOIN establecimientos e ON e.id = p.establecimiento_id
  WHERE p.estado IN ('completado','cancelado')
    AND (p_desde IS NULL OR p.created_at::date >= p_desde)
    AND (p_hasta IS NULL OR p.created_at::date <= p_hasta)
  ORDER BY p.created_at DESC, t.id
$function$;
