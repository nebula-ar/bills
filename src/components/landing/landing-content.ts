export type RubroExample = {
  id: "barberia" | "kiosco" | "tienda" | "servicios";
  label: string;
  businessName: string;
  description: string;
  catalogLabel: string;
  metricValue: string;
  metricChange: string;
  secondaryMetrics: [
    { label: string; value: string },
    { label: string; value: string },
    { label: string; value: string },
  ];
  activity: [
    { title: string; detail: string; value: string; initials: string },
    { title: string; detail: string; value: string; initials: string },
    { title: string; detail: string; value: string; initials: string },
  ];
  note: [string, string];
};

export const landingHero = {
  eyebrow: "Un core. Cada negocio a su manera.",
  title: "Gestioná tu negocio, no un Excel.",
  description:
    "Ventas, caja, stock y clientes en un solo lugar. Bills se adapta a cómo trabajás, desde el primer día.",
  finePrint: "Sin comisión sobre tus ventas · Configuración en minutos",
};

export const rubroExamples: RubroExample[] = [
  {
    id: "barberia",
    label: "Barbería",
    businessName: "Barbería Don Julio",
    description:
      "Turnos, cobros, comisiones y caja en un solo lugar. Bills se adapta a cómo trabajás, desde el primer día.",
    catalogLabel: "Servicios",
    metricValue: "$ 482.600",
    metricChange: "↑ 18,4% vs. período anterior",
    secondaryMetrics: [
      { label: "Turnos", value: "48" },
      { label: "Ticket promedio", value: "$ 10.054" },
      { label: "Resultado neto", value: "$ 192.400" },
    ],
    activity: [
      { title: "Corte + barba", detail: "Lucas · hace 12 min", value: "$ 14.500", initials: "C" },
      { title: "Corte clásico", detail: "Nico · hace 28 min", value: "$ 9.000", initials: "V" },
      { title: "Cera modeladora", detail: "Mercado Pago · hace 45 min", value: "$ 7.000", initials: "P" },
    ],
    note: ["Menos planillas.", "Más control."],
  },
  {
    id: "kiosco",
    label: "Kiosco",
    businessName: "Kiosco El Rulo",
    description:
      "Ventas rápidas, stock y proveedores conectados. Sabé qué salió, qué falta y cuánto te deja cada día.",
    catalogLabel: "Productos",
    metricValue: "$ 1.284.900",
    metricChange: "↑ 12,1% vs. período anterior",
    secondaryMetrics: [
      { label: "Productos", value: "326" },
      { label: "Ticket promedio", value: "$ 4.280" },
      { label: "Resultado neto", value: "$ 386.200" },
    ],
    activity: [
      { title: "Gaseosa 500 ml × 2", detail: "Nico · hace 8 min", value: "$ 4.400", initials: "G" },
      { title: "Alfajor triple × 3", detail: "Efectivo · hace 17 min", value: "$ 5.400", initials: "A" },
      { title: "Compra a proveedor", detail: "Vence en 12 días", value: "$ 128.000", initials: "P" },
    ],
    note: ["Menos faltantes.", "Más margen."],
  },
  {
    id: "tienda",
    label: "Tienda",
    businessName: "Tienda Norte",
    description:
      "Catálogo, variantes, promos y caja para vender con orden, tanto en el local como por tu página pública.",
    catalogLabel: "Catálogo",
    metricValue: "$ 864.300",
    metricChange: "↑ 21,6% vs. período anterior",
    secondaryMetrics: [
      { label: "Pedidos", value: "72" },
      { label: "Ticket promedio", value: "$ 12.004" },
      { label: "Resultado neto", value: "$ 244.800" },
    ],
    activity: [
      { title: "Remera lisa · M", detail: "Sucursal Centro · hace 6 min", value: "$ 18.000", initials: "R" },
      { title: "Jean clásico · 42", detail: "Mercado Pago · hace 31 min", value: "$ 45.000", initials: "J" },
      { title: "Promo temporada", detail: "2 productos · aplicada", value: "-$ 6.000", initials: "P" },
    ],
    note: ["Menos inventario", "a ciegas."],
  },
  {
    id: "servicios",
    label: "Servicios",
    businessName: "Estudio Norte",
    description:
      "Agenda, clientes y cobros para profesionales independientes y equipos de servicios que quieren crecer sin perder el control.",
    catalogLabel: "Servicios",
    metricValue: "$ 638.400",
    metricChange: "↑ 15,8% vs. período anterior",
    secondaryMetrics: [
      { label: "Reservas", value: "39" },
      { label: "Ticket promedio", value: "$ 16.369" },
      { label: "Resultado neto", value: "$ 281.100" },
    ],
    activity: [
      { title: "Consultoría inicial", detail: "Micaela · hace 22 min", value: "$ 28.000", initials: "C" },
      { title: "Plan mensual", detail: "Transferencia · hace 1 h", value: "$ 42.000", initials: "P" },
      { title: "Cliente nuevo", detail: "Agendado para mañana", value: "Próximo", initials: "N" },
    ],
    note: ["Menos seguimiento", "manual."],
  },
];

export const landingFeatures = [
  {
    kicker: "01 / REGISTRÁ",
    title: "Cobrá sin fricción.",
    description: "Un POS simple para vender servicios o productos, con los medios de pago que ya usás.",
  },
  {
    kicker: "02 / ORDENÁ",
    title: "Que los números cierren.",
    description: "Caja, stock, gastos y cuentas a pagar conectados. Nada de copiar datos a otra planilla.",
  },
  {
    kicker: "03 / DECIDÍ",
    title: "Miralo claro.",
    description: "Reportes que te dicen qué se vende, qué falta y dónde está el margen.",
  },
];

export const landingTestimonials = [
  {
    quote: "Antes cerraba el día con tres cuadernos. Ahora veo ventas, caja y stock en la misma pantalla.",
    author: "Ana López",
    role: "Dueña de kiosco",
    business: "Kiosco El Rulo",
  },
  {
    quote: "Bills me dejó ordenar las variantes y las promos sin perder tiempo persiguiendo planillas.",
    author: "Sofía Benítez",
    role: "Dueña de tienda",
    business: "Tienda Norte",
  },
  {
    quote: "Sé qué cobré, qué tengo que hacer mañana y cuánto me dejó el mes. Eso antes estaba repartido en varios lugares.",
    author: "Martín Acosta",
    role: "Profesional independiente",
    business: "Estudio Norte",
  },
];

export const landingPlans = [
  {
    name: "Inicial",
    price: "9.900",
    period: "/mes",
    description: "Para un negocio que quiere dejar el cuaderno y empezar con orden.",
    features: [
      "1 sucursal, 1 terminal de cobro",
      "Empleados ilimitados con PIN propio",
      "Ventas, caja y gastos",
      "Reportes básicos",
      "0% de comisión sobre tus ventas",
    ],
    cta: "Probá gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "18.900",
    period: "/mes",
    description: "Para equipos que necesitan más control operativo todos los días.",
    features: [
      "Todo lo de Inicial",
      "Terminales de cobro ilimitadas",
      "Stock, clientes y promociones",
      "Reportes avanzados",
      "Links de cobro para tu equipo",
      "0% de comisión sobre tus ventas",
    ],
    cta: "Probá gratis",
    highlighted: true,
  },
  {
    name: "Multi-sucursal",
    price: "34.900",
    period: "/mes",
    description: "Para negocios con varias sedes que quieren mirar todo desde un lugar.",
    features: [
      "Todo lo de Pro",
      "Sucursales ilimitadas",
      "Comparación de rendimiento entre sedes",
      "Empleados y precios por sucursal",
      "Soporte prioritario",
      "0% de comisión sobre tus ventas",
    ],
    cta: "Hablar con ventas",
    highlighted: false,
  },
];

export const landingFaqs = [
  {
    q: "¿Para qué tipo de negocio sirve Bills?",
    a: "Para negocios chicos y equipos que venden productos, servicios o una combinación de ambos: barberías, estética, kioscos, tiendas, verdulerías, ferreterías y más.",
  },
  {
    q: "¿Qué cambia cuando elijo mi rubro?",
    a: "Bills adapta el vocabulario, los módulos iniciales, los iconos y el catálogo sugerido. La lógica de ventas, caja y reportes sigue siendo la misma.",
  },
  {
    q: "¿Bills cobra comisión sobre mis ventas?",
    a: "No. Pagás una cuota fija mensual y el resto de lo que factura tu negocio es tuyo.",
  },
  {
    q: "¿Necesito comprar hardware especial?",
    a: "No. Bills funciona desde el celular, la tablet o la computadora que ya usás. Los códigos de barras y las terminales son módulos opcionales.",
  },
  {
    q: "¿Sirve si tengo varias sucursales?",
    a: "Sí. Podés gestionar todas tus sucursales desde una cuenta, comparar rendimiento y asignar empleados, precios y stock por sede.",
  },
  {
    q: "¿Cuánto tarda en implementarse?",
    a: "Podés crear tu negocio en minutos. Bills arranca con una configuración sugerida y después prendés o apagás módulos según lo que necesites.",
  },
  {
    q: "¿Dan soporte en español?",
    a: "Sí, todo el soporte es en español y por WhatsApp.",
  },
];

export type LandingFaq = (typeof landingFaqs)[number];
