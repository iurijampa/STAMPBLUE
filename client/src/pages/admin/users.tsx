import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CircleX, Plus, Pencil, Trash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminUsers() {
  const [user, setUser] = useState<User | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Novos dados do formulário
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("gabarito");
  const [formLoading, setFormLoading] = useState(false);

  // Query para buscar todos os usuários
  const { 
    data: users, 
    isLoading: usersLoading,
    refetch: refetchUsers
  } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users");
      if (!response.ok) {
        throw new Error("Falha ao carregar usuários");
      }
      return response.json();
    },
    enabled: !isLoading && !!user,
  });

  // Verificar autenticação
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        
        if (response.status === 401) {
          navigate("/auth");
          return;
        }
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          
          // Verificar se o usuário é admin
          if (userData.role !== "admin") {
            navigate("/department/dashboard");
          }
        }
      } catch (err) {
        console.error("Erro ao verificar autenticação:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast({
          title: "Logout realizado com sucesso",
        });
        navigate("/auth");
      } else {
        throw new Error('Falha ao fazer logout');
      }
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast({
        title: "Falha no logout",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const openCreateModal = () => {
    // Resetar o formulário
    setUsername("");
    setPassword("");
    setName("");
    setRole("gabarito");
    setIsCreateModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setUsername(user.username);
    setName(user.name);
    setRole(user.role);
    setPassword(""); // Não enviamos a senha atual por segurança
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/users", {
        username,
        password,
        name,
        role
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Falha ao criar usuário");
      }
      
      toast({
        title: "Usuário criado com sucesso",
      });
      
      refetchUsers();
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      toast({
        title: "Falha ao criar usuário",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      return;
    }
    
    setFormLoading(true);
    
    try {
      const userData: any = {
        username,
        name,
        role
      };
      
      // Só enviar senha se for fornecida (opcional na edição)
      if (password.trim()) {
        userData.password = password;
      }
      
      const response = await apiRequest("PUT", `/api/users/${selectedUser.id}`, userData);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Falha ao atualizar usuário");
      }
      
      toast({
        title: "Usuário atualizado com sucesso",
      });
      
      refetchUsers();
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      toast({
        title: "Falha ao atualizar usuário",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) {
      return;
    }
    
    setFormLoading(true);
    
    try {
      const response = await apiRequest("DELETE", `/api/users/${selectedUser.id}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Falha ao excluir usuário");
      }
      
      toast({
        title: "Usuário excluído com sucesso",
      });
      
      refetchUsers();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      toast({
        title: "Falha ao excluir usuário",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50 overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
              <p className="text-muted-foreground mt-1">
                Crie, edite e exclua usuários do sistema
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate("/admin/dashboard")} size="sm">
                Voltar ao Dashboard
              </Button>
              <Button variant="outline" onClick={handleLogout} size="sm">
                Sair
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>Usuários</CardTitle>
              <Button
                onClick={openCreateModal}
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Novo Usuário
              </Button>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !users || users.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <CircleX className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <h3 className="text-lg font-medium text-muted-foreground">Nenhum usuário encontrado</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clique em "Novo Usuário" para criar seu primeiro usuário
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-sm min-w-[650px]">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-4 py-3 text-left font-medium">Nome</th>
                          <th className="px-4 py-3 text-left font-medium">Usuário</th>
                          <th className="px-4 py-3 text-left font-medium">Função</th>
                          <th className="px-4 py-3 text-right font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {users.map((userItem) => (
                          <tr key={userItem.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 truncate max-w-[200px]">{userItem.name}</td>
                            <td className="px-4 py-3 truncate max-w-[150px]">{userItem.username}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                ${userItem.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                                'bg-blue-100 text-blue-800'}`}>
                                {userItem.role === 'admin' ? 'Administrador' : 
                                 userItem.role === 'gabarito' ? 'Gabarito' : 
                                 userItem.role === 'impressao' ? 'Impressão' :
                                 userItem.role === 'batida' ? 'Batida' :
                                 userItem.role === 'costura' ? 'Costura' :
                                 'Embalagem'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => openEditModal(userItem)}
                                >
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Editar
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => openDeleteModal(userItem)}
                                  disabled={userItem.role === 'admin' && users.filter(u => u.role === 'admin').length === 1}
                                >
                                  <Trash className="h-4 w-4 mr-1" />
                                  Excluir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Criação de Usuário */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">Nome de usuário</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Função</Label>
              <select 
                id="role"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                value={role} 
                onChange={(e) => setRole(e.target.value)} 
                required
              >
                <option value="admin">Administrador</option>
                <option value="gabarito">Gabarito</option>
                <option value="impressao">Impressão</option>
                <option value="batida">Batida</option>
                <option value="costura">Costura</option>
                <option value="embalagem">Embalagem</option>
              </select>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={formLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Usuário */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados do usuário selecionado. Deixe a senha em branco para mantê-la inalterada.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome completo</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-username">Nome de usuário</Label>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova senha (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Deixe em branco para manter a senha atual"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-role">Função</Label>
              <select 
                id="edit-role"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                value={role} 
                onChange={(e) => setRole(e.target.value)} 
                required
              >
                <option value="admin">Administrador</option>
                <option value="gabarito">Gabarito</option>
                <option value="impressao">Impressão</option>
                <option value="batida">Batida</option>
                <option value="costura">Costura</option>
                <option value="embalagem">Embalagem</option>
              </select>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={formLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão de Usuário */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="mb-2">
              <span className="font-semibold">Nome:</span> {selectedUser?.name}
            </p>
            <p className="mb-2">
              <span className="font-semibold">Usuário:</span> {selectedUser?.username}
            </p>
            <p>
              <span className="font-semibold">Função:</span> {
                selectedUser?.role === 'admin' ? 'Administrador' : 
                selectedUser?.role === 'gabarito' ? 'Gabarito' : 
                selectedUser?.role === 'impressao' ? 'Impressão' :
                selectedUser?.role === 'batida' ? 'Batida' :
                selectedUser?.role === 'costura' ? 'Costura' :
                'Embalagem'
              }
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={formLoading}>
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDeleteUser} 
              disabled={formLoading}
            >
              {formLoading ? "Excluindo..." : "Excluir Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}