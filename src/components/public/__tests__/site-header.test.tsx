import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<"button">) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("@/components/shared/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

// Sheet mock — always renders children (the SheetContent is visible in the DOM
// regardless of `open` prop; Radix hides it via portal/visibility, but our mock
// is simpler). This means desktop and mobile elements coexist — tests use
// getAllBy* / container queries where needed.
vi.mock("@/components/ui/sheet", () => {
  const Sheet = ({
    children,
  }: {
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
    children: React.ReactNode;
  }) => <div data-testid="sheet">{children}</div>;
  const SheetTrigger = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  const SheetContent = ({
    children,
    side,
    className,
  }: {
    children: React.ReactNode;
    side?: string;
    className?: string;
  }) => (
    <div data-testid="sheet-content" data-side={side} className={className}>
      {children}
    </div>
  );
  const SheetHeader = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  const SheetTitle = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>;
  const SheetClose = ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  );
  return { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose };
});

// Store fixture
const h = vi.hoisted(() => ({
  settings: null as Record<string, unknown> | null,
}));

vi.mock("@/store/app", () => ({
  useAppStore: (
    selector: (s: { settings: Record<string, unknown> | null }) => unknown,
  ) => selector({ settings: h.settings }),
}));

// Mock window.open
const originalOpen = window.open;

import { SiteHeader } from "../site-header";

beforeEach(() => {
  pushMock.mockClear();
  window.open = vi.fn();
  h.settings = null;
  Object.defineProperty(window, "scrollY", { value: 0, writable: true });
});

afterEach(() => {
  window.open = originalOpen;
});

// ── Tests ──────────────────────────────────────────────────────────
describe("SiteHeader", () => {
  it("renders default school name when settings are null", () => {
    render(<SiteHeader />);
    // School name appears in both brand and mobile sheet — use getAllByText
    const names = screen.getAllByText("SD Negeri Unggulan Mongisidi 1");
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  it("renders school name from settings", () => {
    h.settings = { schoolName: "SMA Negeri 1 Makassar" };
    render(<SiteHeader />);
    const names = screen.getAllByText("SMA Negeri 1 Makassar");
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  it("shows NPSN when available in settings", () => {
    h.settings = { npsn: "40313912" };
    render(<SiteHeader />);
    // NPSN appears in brand and mobile sheet
    const npsnEls = screen.getAllByText("NPSN 40313912");
    expect(npsnEls.length).toBeGreaterThanOrEqual(1);
  });

  it("shows default dash when no NPSN", () => {
    render(<SiteHeader />);
    const npsnEls = screen.getAllByText(/NPSN/);
    expect(npsnEls.length).toBeGreaterThanOrEqual(1);
    expect(npsnEls[0].textContent).toContain("—");
  });

  it("renders all desktop nav items in the main navigation", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Navigasi utama" });
    const labels = [
      "Beranda",
      "Profil",
      "Struktur Organisasi",
      "Akademik",
      "Berita",
      "Galeri",
      "Transparansi",
      "Pengaduan",
      "Kontak",
    ];
    for (const label of labels) {
      expect(within(nav).getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("sets aria-current=page on the active nav item", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Navigasi utama" });
    const beranda = within(nav).getByRole("button", { name: "Beranda" });
    expect(beranda).toHaveAttribute("aria-current", "page");
  });

  it("navigates to / when brand is clicked", () => {
    render(<SiteHeader />);
    // Brand has aria-label ending with "— Beranda"
    const brand = screen.getByRole("button", { name: /— Beranda$/ });
    fireEvent.click(brand);
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("SPMB button opens external link when spmbLink is set", () => {
    h.settings = { spmbLink: "https://spmb.example.com" };
    render(<SiteHeader />);
    // SPMB buttons appear in desktop + mobile — click the first (desktop)
    const spmbBtns = screen.getAllByRole("button", { name: /SPMB/ });
    expect(spmbBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(spmbBtns[0]);
    expect(window.open).toHaveBeenCalledWith(
      "https://spmb.example.com",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("SPMB button navigates to /contact when no spmbLink", () => {
    render(<SiteHeader />);
    const spmbBtns = screen.getAllByRole("button", { name: /SPMB/ });
    expect(spmbBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(spmbBtns[0]);
    expect(pushMock).toHaveBeenCalledWith("/contact");
  });

  it("shows logo image when settings.logo is provided", () => {
    h.settings = { logo: "/logo.png" };
    render(<SiteHeader />);
    const logos = screen.getAllByRole("img", { name: /Logo/ });
    expect(logos.length).toBeGreaterThan(0);
    expect(logos[0]).toHaveAttribute("src", "/logo.png");
  });

  it("renders hamburger menu button", () => {
    render(<SiteHeader />);
    expect(
      screen.getByRole("button", { name: "Buka menu navigasi" }),
    ).toBeInTheDocument();
  });

  it("mobile nav is rendered inside the sheet", () => {
    render(<SiteHeader />);
    // The SheetContent is always rendered in our mock
    const mobileNav = screen.getAllByRole("navigation", {
      name: "Navigasi mobile",
    });
    expect(mobileNav.length).toBeGreaterThanOrEqual(1);

    // All public nav items should be listed in the mobile nav
    for (const label of ["Beranda", "Profil", "Berita", "Kontak"]) {
      expect(within(mobileNav[0]).getByText(label)).toBeInTheDocument();
    }
  });

  it("renders theme toggle and language switcher", () => {
    render(<SiteHeader />);
    // ThemeToggle appears in desktop header + mobile Sheet
    const toggles = screen.getAllByTestId("theme-toggle");
    expect(toggles.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId("language-switcher")).toBeInTheDocument();
  });
});
