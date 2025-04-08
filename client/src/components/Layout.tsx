import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Menu, LogOut, ChevronDown, CheckCircle2 } from "lucide-react";
import { Notification } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Logo, FooterCredits } from "@/components/ui/logo";

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  // Get notifications
  const { 
    data: notifications = [],
    refetch: refetchNotifications
  } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Função para marcar notificação como lida
  const markAsRead = async (notificationId: number) => {
    if (!user) return;
    
    try {
      await apiRequest("PUT", `/api/notifications/${notificationId}/read`);
      refetchNotifications();
    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
    }
  };

  const isAdmin = user?.role === "admin";
  
  const adminNavItems = [
    { name: "Dashboard", href: "/admin/dashboard", icon: "ri-dashboard-line" },
    { name: "Atividades", href: "/admin/activities", icon: "ri-task-line" },
    { name: "Usuários", href: "/admin/users", icon: "ri-user-settings-line" },
    { name: "Histórico", href: "/admin/history", icon: "ri-time-line" },
    { name: "Configurações", href: "/admin/settings", icon: "ri-settings-3-line" },
  ];
  
  const departmentNavItems = [
    { name: "Dashboard", href: "/department/dashboard", icon: "ri-dashboard-line" },
    { name: "Histórico", href: "/department/history", icon: "ri-time-line" },
    { name: "Configurações", href: "/department/settings", icon: "ri-settings-3-line" },
  ];

  const navItems = isAdmin ? adminNavItems : departmentNavItems;

  // Get user initials for avatar
  const userInitials = user?.name 
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
    : 'US';

  // Format department name nicely
  const formatDepartment = (role: string) => {
    if (role === "admin") return "Administrador";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar for desktop */}
      <aside className="bg-neutral-800 text-white w-64 flex-shrink-0 hidden md:block">
        <div className="p-4 h-full flex flex-col">
          <div className="mb-8 mt-2">
            <Logo size="lg" className="text-white" />
          </div>
          
          {/* User Info */}
          <div className="bg-neutral-700 rounded-lg p-3 mb-6 flex items-center">
            <div className="bg-primary-700 h-10 w-10 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-medium">{userInitials}</span>
            </div>
            <div>
              <div className="font-medium">{user?.name}</div>
              <div className="text-xs text-neutral-400">{formatDepartment(user?.role || '')}</div>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <div className={cn(
                      "flex items-center py-2 px-3 rounded-md transition-colors cursor-pointer",
                      location === item.href
                        ? "text-white bg-primary-700"
                        : "text-neutral-300 hover:bg-neutral-700"
                    )}>
                      <i className={`${item.icon} mr-3 text-lg`}></i>
                      <span>{item.name}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          
          <div className="mt-auto">
            <button 
              onClick={handleLogout}
              className="flex items-center py-2 px-3 rounded-md text-neutral-300 hover:bg-neutral-700 transition-colors w-full"
            >
              <i className="ri-logout-box-line mr-3 text-lg"></i>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-neutral-800 text-white border-neutral-700 p-0">
                <div className="p-4 h-full flex flex-col">
                  <div className="mb-8 mt-2">
                    <Logo size="lg" className="text-white" />
                  </div>
                  
                  {/* User Info */}
                  <div className="bg-neutral-700 rounded-lg p-3 mb-6 flex items-center">
                    <div className="bg-primary-700 h-10 w-10 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white font-medium">{userInitials}</span>
                    </div>
                    <div>
                      <div className="font-medium">{user?.name}</div>
                      <div className="text-xs text-neutral-400">{formatDepartment(user?.role || '')}</div>
                    </div>
                  </div>
                  
                  {/* Navigation */}
                  <nav className="flex-1">
                    <ul className="space-y-2">
                      {navItems.map((item) => (
                        <li key={item.href}>
                          <Link href={item.href}>
                            <div 
                              className={cn(
                                "flex items-center py-2 px-3 rounded-md transition-colors cursor-pointer",
                                location === item.href
                                  ? "text-white bg-primary-700"
                                  : "text-neutral-300 hover:bg-neutral-700"
                              )}
                              onClick={() => setOpen(false)}
                            >
                              <i className={`${item.icon} mr-3 text-lg`}></i>
                              <span>{item.name}</span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </nav>
                  
                  <div className="mt-auto">
                    <button 
                      onClick={() => {
                        handleLogout();
                        setOpen(false);
                      }}
                      className="flex items-center py-2 px-3 rounded-md text-neutral-300 hover:bg-neutral-700 transition-colors w-full"
                    >
                      <i className="ri-logout-box-line mr-3 text-lg"></i>
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            
            <h2 className="text-lg font-semibold text-neutral-800">{title}</h2>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-2 font-medium border-b">Notificações</div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-neutral-500">
                    Nenhuma notificação
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notification: any) => (
                      <DropdownMenuItem 
                        key={notification.id} 
                        className="flex justify-between items-start cursor-default px-3 py-2 hover:bg-neutral-100"
                      >
                        <div className={cn(
                          "w-full",
                          !notification.read && "font-medium"
                        )}>
                          <div className="mb-1">{notification.message}</div>
                          <div className="text-xs text-neutral-500">
                            {new Date(notification.createdAt).toLocaleString('pt-BR')}
                          </div>
                        </div>
                        {!notification.read && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="ml-2 h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="sr-only">Marcar como lido</span>
                          </Button>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu (Mobile) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="bg-primary-700 h-8 w-8 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">{userInitials}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-500"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 pb-6 lg:p-6 scrollbar-thin bg-neutral-100">
          {children}
          <FooterCredits />
        </main>
      </div>
    </div>
  );
}
